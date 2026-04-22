/**
 * Game-agnostic Bun multiplayer server.
 * Usage: bun --hot examples/server.ts <game>
 * Available games: tictactoe, uno
 */
/// <reference types="bun-types" />
import type { Server, ServerWebSocket } from 'bun';
import { fileURLToPath } from 'url';

function url(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}
import {
  Entity,
  entityId,
  type EnhancedChoice,
  type Action,
  type PlayerEntity,
  type Snapshot,
  type Game,
} from '@my-engine/library';
import { TicTacToe } from '../../library/tests/tictactoe/tictactoe';
import { Uno } from '../../library/tests/uno/uno';

// ---- game registry --------------------------------------------------------

type GameConfig = {
  playerCount: number;
  createGame: () => Game<any>;
  entrypoint: string;
  html: string;
};

const GAMES: Record<string, GameConfig> = {
  tictactoe: {
    playerCount: 2,
    createGame: () => new TicTacToe({ firstPlayer: 'X' }),
    entrypoint: url('./tictactoe/server-client.ts'),
    html: url('./tictactoe/index.html'),
  },
  uno: {
    playerCount: 4,
    createGame: () => new Uno({ playerSize: 4 }),
    entrypoint: url('./uno/server-client.ts'),
    html: url('./uno/index.html'),
  },
};

const gameName = Bun.argv[2] ?? 'tictactoe';
const config = GAMES[gameName];
if (!config) {
  throw new Error(
    `Unknown game "${gameName}". Available: ${Object.keys(GAMES).join(', ')}`,
  );
}

// ---- serialization helpers ------------------------------------------------

function ser(v: unknown): unknown {
  if (v instanceof Entity) return `$ENGINE:${v[entityId]}`;
  if (Array.isArray(v)) return v.map(ser);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, ser(x)]),
    );
  return v;
}

// ---- lobby state ----------------------------------------------------------

type WsData = { id: string; lobbyId: string | null };
type GameWS = ServerWebSocket<WsData>;

type Lobby = {
  wss: GameWS[];
  game: Game<any> | null;
  pending: Map<
    number,
    (choice: EnhancedChoice<Action<string, any, any>>) => void
  >;
  votes: Set<number>;
};

const lobbies = new Map<string, Lobby>();

function getLobby(id: string): Lobby {
  let lobby = lobbies.get(id);
  if (!lobby) {
    lobby = { wss: [], game: null, pending: new Map(), votes: new Set() };
    lobbies.set(id, lobby);
  }
  return lobby;
}

// ---- game lifecycle -------------------------------------------------------

function startGame(lobby: Lobby): void {
  lobby.pending.clear();
  lobby.votes.clear();
  const game = config.createGame();
  lobby.game = game;

  const players = game.players();
  for (let i = 0; i < lobby.wss.length; i++) {
    const ws = lobby.wss[i]!;
    const player = players[i] as PlayerEntity;
    const playerIndex = i;

    ws.send(JSON.stringify({ type: 'SETUP', payload: { playerIndex } }));

    game.registerPlayerCallback(player, {
      state: (snapshots: Snapshot[]) => {
        ws.send(
          JSON.stringify({
            type: 'STATE',
            payload: {
              state: snapshots.map((s) => ({
                dirtyEntities: s.dirtyEntities,
                executed: s.executed
                  ? {
                      $type: s.executed.$type,
                      parameters: ser(s.executed.parameters),
                    }
                  : undefined,
              })),
            },
          }),
        );
      },
      prompt: (
        choices: EnhancedChoice<Action<string, any, any>>[],
        execute,
      ) => {
        lobby.pending.set(playerIndex, execute as any);
        ws.send(JSON.stringify({ type: 'CHOICES', payload: { choices } }));
      },
    });
  }
}

// ---- build bundle ---------------------------------------------------------

const { outputs, success } = await Bun.build({
  entrypoints: [config.entrypoint],
  target: 'browser',
  minify: false,
});

if (!success) {
  throw new Error('Bundle build failed');
}

const bundle = await outputs[0]!.text();
const htmlRaw = await Bun.file(config.html).text();

// Inline the bundle into the HTML.
const html = htmlRaw
  .replace(/<script[^>]+src="[^"]*"[^>]*><\/script>/, '')
  .replace('</body>', `<script type="module">${bundle}</script></body>`);

// ---- HTTP / WebSocket server ----------------------------------------------

const PORT = parseInt(Bun.env['PORT'] ?? '3000', 10);

Bun.serve<WsData>({
  port: PORT,
  fetch(req: Request, server: Server<WsData>) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, {
        data: { id: crypto.randomUUID(), lobbyId: null },
      });
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
  websocket: {
    open(ws: GameWS) {
      console.log(`[ws] connected ${ws.data.id}`);
    },
    close(ws: GameWS) {
      const lobbyId = ws.data.lobbyId;
      if (!lobbyId) return;
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;
      lobby.wss = lobby.wss.filter((w) => w !== ws);
      if (lobby.wss.length === 0) lobbies.delete(lobbyId);
    },
    message(ws: GameWS, raw: string | Buffer) {
      const msg = JSON.parse(raw as string) as {
        type: string;
        [k: string]: any;
      };

      if (msg.type === 'JOIN') {
        const lobbyId: string = msg.lobbyId;
        ws.data.lobbyId = lobbyId;
        const lobby = getLobby(lobbyId);

        if (lobby.wss.length >= config.playerCount) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Lobby full' }));
          return;
        }

        lobby.wss.push(ws);
        console.log(`[lobby ${lobbyId}] player ${lobby.wss.length - 1} joined`);

        if (lobby.wss.length === config.playerCount) {
          console.log(`[lobby ${lobbyId}] starting game`);
          startGame(lobby);
        }
        return;
      }

      const lobbyId = ws.data.lobbyId;
      if (!lobbyId) return;
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;
      const playerIndex = lobby.wss.indexOf(ws);
      if (playerIndex === -1) return;

      if (msg.type === 'CHOICE') {
        const execute = lobby.pending.get(playerIndex);
        if (!execute) return;
        lobby.pending.delete(playerIndex);
        execute(msg.payload.choiceId);
        return;
      }

      if (msg.type === 'PLAY_AGAIN') {
        lobby.votes.add(playerIndex);
        if (lobby.votes.size === lobby.wss.length) {
          console.log(`[lobby ${lobbyId}] restarting game`);
          startGame(lobby);
        }
        return;
      }
    },
  },
});

console.log(`[${gameName}] server listening on http://localhost:${PORT}`);
