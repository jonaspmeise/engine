import type { ServerWebSocket } from 'bun';
import { join } from 'path';
import type { Game } from '@my-engine/library';
import type { ClientMessage, ServerMessage } from './messages';
import type {
  GameServerConfig,
  ServerOptions,
  SessionKey,
  WebSocketId,
} from './server.types';
import { LobbyStore, type LobbyId } from './lobby';
import { GameSession, type SessionSendFn } from './game-session';

// ── Connection data ───────────────────────────────────────────────────────────

export type ConnectionData = {
  readonly playerId: WebSocketId;
};

// ── Server state ──────────────────────────────────────────────────────────────

type ServerState = {
  readonly game: GameServerConfig<any>;
  readonly lobbyStore: LobbyStore;
  /** Running game sessions keyed by lobby ID. */
  readonly sessions: Map<LobbyId, GameSession>;
  /** Sends a ServerMessage to a specific connected client via pub/sub. */
  readonly sendToPlayer: SessionSendFn;
  readonly clientBundle: string;
  readonly gameStyles: string;
  readonly singleplayerPage: string;
  readonly menuBundle: string;
  /** Adapted HTML for the multiplayer route, or undefined if not configured. */
  readonly multiplayerPage: string | undefined;
};

// ── Asset building ────────────────────────────────────────────────────────────

export async function buildBundle(entry: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entry],
    target: 'browser',
    minify: false,
    sourcemap: 'none',
  });

  if (!result.success) {
    const messages = result.logs.map((l) => l.message).join('\n');
    throw new Error(`Failed to bundle ${entry}:\n${messages}`);
  }

  const [output] = result.outputs;
  if (output === undefined)
    throw new Error(`Bun.build produced no output for ${entry}`);

  return output.text();
}

// ── HTML page building ────────────────────────────────────────────────────────

const MAIN_MENU_HTML_PATH = join(import.meta.dir, '../public/index.html');
const MAIN_MENU_ENTRY_PATH = join(import.meta.dir, '../public/index.ts');

function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return Object.entries(vars).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
    template,
  );
}

function buildSingleplayerPage(html: string): string {
  let result = html;

  // Replace the local module script with the server-bundled version.
  result = result.replace(
    /<script\s+type="module"\s+src="[^"]*"><\/script>/g,
    '<script type="module" src="/game.js"></script>',
  );

  // Replace local CSS links with the server route.
  result = result.replace(
    /<link\s+rel="stylesheet"\s+href="(?!\/)[^"]*"\s*\/?>/g,
    '<link rel="stylesheet" href="/game.css">',
  );

  // Inject a "game:reset → back to menu" override before </head>.
  const override = `  <script>
    // Return to the main menu when the game ends instead of restarting.
    document.addEventListener('game:reset', function() {
      window.location.href = '/';
    }, { capture: true });
  </script>`;

  return result.replace('</head>', `${override}\n  </head>`);
}

/**
 * Builds the multiplayer variant of the game page.
 * Loads the same `/game.js` bundle which detects the `/multiplayer` path at runtime.
 */
function buildMultiplayerPage(html: string): string {
  let result = html;

  result = result.replace(
    /<script\s+type="module"\s+src="[^"]*"><\/script>/g,
    '<script type="module" src="/game.js"></script>',
  );

  result = result.replace(
    /<link\s+rel="stylesheet"\s+href="(?!\/)[^"]*"\s*\/?>/g,
    '<link rel="stylesheet" href="/game.css">',
  );

  const override = `  <script>
    document.addEventListener('game:reset', function() {
      window.location.href = '/';
    }, { capture: true });
  </script>`;

  return result.replace('</head>', `${override}\n  </head>`);
}

// ── HTTP response helpers ─────────────────────────────────────────────────────

function serveHtml(html: string): Response {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function serveJs(js: string): Response {
  return new Response(js, {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
  });
}

function serveCss(css: string): Response {
  return new Response(css, {
    headers: { 'Content-Type': 'text/css; charset=utf-8' },
  });
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

function send(
  ws: ServerWebSocket<ConnectionData>,
  message: ServerMessage,
): void {
  ws.send(JSON.stringify(message));
}

// ── Game session lifecycle ────────────────────────────────────────────────────

/**
 * Creates and starts a `GameSession` for the given lobby once it is full.
 * Maps lobby players (join order) to game `PlayerEntity` objects (spawn order).
 */
async function startGameSession(
  lobbyId: LobbyId,
  state: ServerState,
): Promise<void> {
  const lobby = state.lobbyStore.lobbies.get(lobbyId);
  if (lobby === undefined || state.sessions.has(lobbyId)) return;

  const lobbyData = lobby.players.map((pid) => lobby.playerData.get(pid));
  const gameInstance = (state.game.createGame as (d: unknown[]) => Game<any>)(
    lobbyData,
  );

  const gamePlayers = gameInstance.players();
  const playerMap = new Map(
    lobby.players.map((wsPlayerId, index) => [wsPlayerId, gamePlayers[index]!]),
  );

  const session = new GameSession(gameInstance, playerMap, state.sendToPlayer);
  state.sessions.set(lobbyId, session);

  for (const wsPlayerId of playerMap.keys()) {
    const sessionKey = session.getSessionKey(wsPlayerId)!;
    state.sendToPlayer(wsPlayerId, {
      type: 'GAME_STARTED',
      payload: { sessionKey },
    });
  }

  gameInstance.registerCallbacks({
    onEnd: makeGameEndCallback(session, lobbyId, state),
  });

  await session.start();
}

/** Builds the onEnd callback for a game, keeping the session alive for restart votes. */
function makeGameEndCallback(
  session: GameSession,
  lobbyId: LobbyId,
  state: ServerState,
): () => void {
  return () => {
    for (const wsPlayerId of session.playerIds()) {
      state.sendToPlayer(wsPlayerId, { type: 'GAME_OVER' });
    }
    session.markEnded();
    console.info(`[lobby] ${lobbyId} game ended (awaiting restart or cleanup)`);
  };
}

/** Returns the active `GameSession` the given player is part of, or `undefined`. */
function findSessionForPlayer(
  wsPlayerId: WebSocketId,
  state: ServerState,
): GameSession | undefined {
  for (const session of state.sessions.values()) {
    if (session.hasPlayer(wsPlayerId)) return session;
  }
  return undefined;
}

// ── Message handler ───────────────────────────────────────────────────────────

function handleMessage(
  ws: ServerWebSocket<ConnectionData>,
  message: ClientMessage,
  state: ServerState,
): void {
  switch (message.type) {
    case 'CREATE_LOBBY': {
      const id = state.lobbyStore.createLobby();
      state.lobbyStore.joinLobby(id, ws.data.playerId, message.payload?.data);
      console.info(`[lobby] ${id} created by ${ws.data.playerId}`);
      send(ws, { type: 'LOBBY_CREATED', payload: { id } });

      // A single-player lobby is immediately full.
      if (state.game.playerCount === 1) {
        void startGameSession(id, state);
      }
      break;
    }
    case 'JOIN_LOBBY': {
      const { id } = message.payload;
      if (!state.lobbyStore.lobbies.has(id)) {
        send(ws, {
          type: 'ERROR',
          payload: { message: `Lobby "${id}" not found.` },
        });
        return;
      }
      state.lobbyStore.joinLobby(id, ws.data.playerId, message.payload.data);
      console.info(`[lobby] ${id} joined by ${ws.data.playerId}`);

      // Start the session once the lobby has enough players.
      const lobby = state.lobbyStore.lobbies.get(id);
      if (
        lobby !== undefined &&
        lobby.players.length >= state.game.playerCount &&
        !state.sessions.has(id)
      ) {
        void startGameSession(id, state);
      }
      break;
    }
    case 'REQUEST_STATE': {
      // Re-register the player's callback so the game re-delivers their state.
      const session = findSessionForPlayer(ws.data.playerId, state);
      if (session === undefined || session.isEnded()) {
        send(ws, {
          type: 'ERROR',
          payload: { message: 'No active game session found.' },
        });
        return;
      }
      void session.requestState(ws.data.playerId);
      break;
    }
    case 'CHOICE': {
      const session = findSessionForPlayer(ws.data.playerId, state);
      if (session === undefined || session.isEnded()) {
        send(ws, {
          type: 'ERROR',
          payload: { message: 'No active game session found.' },
        });
        return;
      }
      const accepted = session.handleChoice(
        ws.data.playerId,
        message.payload.choiceId,
      );
      if (!accepted) {
        send(ws, {
          type: 'ERROR',
          payload: { message: 'No pending prompt for this player.' },
        });
      }
      break;
    }
    case 'PLAY_AGAIN': {
      const session = findSessionForPlayer(ws.data.playerId, state);
      if (session === undefined || !session.isEnded()) {
        send(ws, {
          type: 'ERROR',
          payload: { message: 'No ended game session found.' },
        });
        return;
      }
      const allVoted = session.voteRestart(ws.data.playerId);
      if (allVoted) {
        // Find this session's lobby ID so we can rebuild the onEnd callback.
        let lobbyId: LobbyId | undefined;
        for (const [id, s] of state.sessions.entries()) {
          if (s === session) {
            lobbyId = id;
            break;
          }
        }
        if (lobbyId === undefined) return;
        const lid = lobbyId;
        const restartLobby = state.lobbyStore.lobbies.get(lid);
        const restartData =
          restartLobby !== undefined
            ? restartLobby.players.map((pid) => restartLobby.playerData.get(pid))
            : [];
        void session.restart(
          () =>
            (state.game.createGame as (d: unknown[]) => Game<any>)(restartData),
          makeGameEndCallback(session, lid, state),
        );
        console.info(`[lobby] ${lid} game restarted`);
      }
      break;
    }
    case 'RECONNECT': {
      const { sessionKey } = message.payload;
      // Find the session that issued this key.
      let foundSession: GameSession | undefined;
      let oldPlayerId: WebSocketId | undefined;
      for (const session of state.sessions.values()) {
        const pid = session.findPlayerBySessionKey(sessionKey as SessionKey);
        if (pid !== undefined) {
          foundSession = session;
          oldPlayerId = pid;
          break;
        }
      }
      if (foundSession === undefined || oldPlayerId === undefined) {
        send(ws, {
          type: 'ERROR',
          payload: { message: 'Invalid or expired session key.' },
        });
        return;
      }
      // Reject reconnect to ended sessions — the game is over.
      if (foundSession.isEnded()) {
        send(ws, {
          type: 'ERROR',
          payload: { message: 'Invalid or expired session key.' },
        });
        return;
      }
      // Migrate the player to their new WebSocket ID and re-deliver state.
      foundSession.updatePlayerId(oldPlayerId, ws.data.playerId);
      void foundSession.requestState(ws.data.playerId);
      break;
    }
  }
}

// ── Server factory ────────────────────────────────────────────────────────────

export async function createServer(
  game: GameServerConfig<any>,
  options: ServerOptions = {},
): Promise<Bun.Server<ConnectionData>> {
  const { port = 3000 } = options;

  const [menuBundle, rawMenuHtml] = await Promise.all([
    buildBundle(MAIN_MENU_ENTRY_PATH),
    Bun.file(MAIN_MENU_HTML_PATH).text(),
  ]);

  const clientBundle = game.files.client;
  const gameStyles = game.files.styles ?? '';
  const singleplayerPage = buildSingleplayerPage(game.files.html);
  const multiplayerPage = game.multiplayer
    ? buildMultiplayerPage(game.files.html)
    : undefined;

  const mainMenuHtml = renderTemplate(rawMenuHtml, { GAME_NAME: game.name });

  // `sendToPlayer` closes over `bunServer` which is assigned right after
  // `Bun.serve()` returns. Sessions only call this after the server is live,
  // so the reference is always resolved by the time it is used.
  let bunServer: Bun.Server<ConnectionData>;
  const sendToPlayer: SessionSendFn = (wsPlayerId, msg) =>
    bunServer.publish(wsPlayerId, JSON.stringify(msg));

  const state: ServerState = {
    game,
    lobbyStore: new LobbyStore(),
    sessions: new Map(),
    sendToPlayer,
    clientBundle,
    gameStyles,
    singleplayerPage,
    menuBundle,
    multiplayerPage,
  };

  bunServer = Bun.serve<ConnectionData>({
    port,
    fetch(req, server) {
      const { pathname } = new URL(req.url);

      // WebSocket upgrade.
      if (pathname === '/ws') {
        const upgraded = server.upgrade(req, {
          data: { playerId: crypto.randomUUID() as WebSocketId },
        });
        if (upgraded) return undefined;
        return new Response('WebSocket upgrade failed.', { status: 400 });
      }

      switch (pathname) {
        case '/':
          return serveHtml(mainMenuHtml);
        case '/play':
          return serveHtml(state.singleplayerPage);
        case '/multiplayer':
          if (state.multiplayerPage === undefined) {
            return new Response('Multiplayer not available.', { status: 404 });
          }
          return serveHtml(state.multiplayerPage);
        case '/game.js':
          return serveJs(state.clientBundle);
        case '/game.css':
          return serveCss(state.gameStyles);
        case '/menu.js':
          return serveJs(state.menuBundle);
        default:
          return new Response('Not Found', { status: 404 });
      }
    },
    websocket: {
      open(ws) {
        // Subscribe to a personal topic so game sessions can push messages
        // to this specific connection via server.publish(playerId, …).
        ws.subscribe(ws.data.playerId);
        console.info(`[ws] ${ws.data.playerId} connected`);
      },
      message(ws, raw) {
        let message: ClientMessage;
        try {
          message = JSON.parse(
            typeof raw === 'string' ? raw : raw.toString(),
          ) as ClientMessage;
        } catch {
          send(ws, { type: 'ERROR', payload: { message: 'Invalid JSON.' } });
          return;
        }
        handleMessage(ws, message, state);
      },
      close(ws) {
        console.info(`[ws] ${ws.data.playerId} disconnected`);
        ws.unsubscribe(ws.data.playerId);
        const playerId = ws.data.playerId;

        // If the player is in an ended session (awaiting restart votes), clean up
        // immediately and notify any remaining connected players.
        for (const [lobbyId, session] of state.sessions.entries()) {
          if (session.hasPlayer(playerId) && session.isEnded()) {
            for (const otherId of session.playerIds()) {
              if (otherId !== playerId) {
                state.sendToPlayer(otherId, { type: 'GAME_OVER' });
              }
            }
            state.sessions.delete(lobbyId);
            state.lobbyStore.deleteLobby(lobbyId);
            console.info(
              `[lobby] ${lobbyId} deleted (player disconnected during ended session)`,
            );
            return;
          }
        }

        // Record which lobbies this player is in before removing them.
        const affectedLobbyIds = [...state.lobbyStore.lobbies.entries()]
          .filter(([, lobby]) => lobby.players.includes(playerId))
          .map(([id]) => id);
        state.lobbyStore.leaveLobby(playerId);
        // If a lobby became empty and no game session is running, remove it.
        // When a session exists the players are expected to reconnect via RECONNECT,
        // so we must NOT delete the session here.
        for (const lobbyId of affectedLobbyIds) {
          if (!state.lobbyStore.lobbies.has(lobbyId)) {
            if (!state.sessions.has(lobbyId)) {
              state.sessions.delete(lobbyId);
              console.info(
                `[lobby] ${lobbyId} deleted (all players disconnected)`,
              );
            }
          }
        }
      },
    },
  });

  return bunServer;
}

// ── GameServer ────────────────────────────────────────────────────────────────

/**
 * The batteries-included entry point for hosting a game.
 *
 * ```ts
 * import { GameServer } from '@my-engine/server';
 * import { TicTacToeConfig } from './tictactoe';
 *
 * new GameServer(TicTacToeConfig).run();
 * ```
 */
export class GameServer<TLobbyData = void> {
  constructor(private readonly _config: GameServerConfig<TLobbyData>) {}

  /**
   * Starts the HTTP + WebSocket server and returns the Bun server handle.
   * Prefer {@link run} when you just want to start and log.
   */
  public start(options: ServerOptions = {}): Promise<Bun.Server<ConnectionData>> {
    return createServer(this._config as GameServerConfig<any>, options);
  }

  /**
   * Starts the server, logs the URL, and keeps the process alive.
   * This is the recommended entry point for production use.
   */
  public async run(options: ServerOptions = {}): Promise<void> {
    const server = await this.start(options);
    console.info(
      `[server] http://${server.hostname}:${server.port}  (${this._config.name})`,
    );
  }
}
