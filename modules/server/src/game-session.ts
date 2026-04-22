import {
  Entity,
  entityId,
  type Action,
  type ChoiceId,
  type EnhancedChoice,
  type Game,
  type PlayerEntity,
  type PlayerInterfaceCallback,
  type Snapshot,
} from '@my-engine/library';
import type { ServerMessage } from './messages';
import type { SessionKey, WebSocketId } from './server.types';

/**
 * Callback used by a {@link GameSession} to push messages back to a specific
 * connected client, identified by their WebSocket player ID.
 */
export type SessionSendFn = (
  wsPlayerId: WebSocketId,
  message: ServerMessage,
) => void;

/**
 * Represents a single running multiplayer game tied to one lobby.
 *
 * Bridges WebSocket connections (identified by ephemeral player ID strings)
 * with the library's `Game` engine (identified by `PlayerEntity` objects).
 * Once {@link start} is called, the underlying `Game` begins as soon as every
 * mapped player has a registered callback.
 */
export class GameSession {
  /**
   * Pending `execute` callbacks, keyed by WebSocket player ID.
   * Populated when the game prompts a player; cleared once their choice arrives.
   */
  private readonly _pendingExecute = new Map<
    WebSocketId,
    (choice: EnhancedChoice<Action<string, any, any>> | ChoiceId) => void
  >();

  /**
   * Mutable player map — updated on reconnection when a player gets a new
   * WebSocket ID.
   */
  private readonly _playerMap: Map<WebSocketId, PlayerEntity>;

  /**
   * Per-player session keys issued at session start.
   * Used to authenticate reconnecting clients.
   */
  private readonly _sessionKeys: Map<WebSocketId, SessionKey>;

  /** True after the game ends, until a restart clears it. */
  private _gameEnded = false;

  /** Players who have voted to play again after the game ended. */
  private readonly _pendingRestartVotes = new Set<WebSocketId>();

  /** The currently active game instance (replaced on restart). */
  private _game: Game<any>;

  /**
   * @param _game       The game instance managed by this session.
   * @param playerMap   Maps each WebSocket player ID to its corresponding
   *                    `PlayerEntity` inside the game.
   * @param _send       Callback used to push `ServerMessage`s to a specific client.
   */
  constructor(
    game: Game<any>,
    playerMap: ReadonlyMap<WebSocketId, PlayerEntity>,
    private readonly _send: SessionSendFn,
  ) {
    this._game = game;
    this._playerMap = new Map(playerMap);
    this._sessionKeys = new Map(
      [...playerMap.keys()].map((id) => [
        id,
        crypto.randomUUID() as SessionKey,
      ]),
    );
  }

  /** Returns `true` when the given WebSocket player ID belongs to this session. */
  public hasPlayer(wsPlayerId: WebSocketId): boolean {
    return this._playerMap.has(wsPlayerId);
  }

  /**
   * Returns the session key for the given player, or `undefined` if not found.
   * Used by the server to include the key in the `GAME_STARTED` message.
   */
  public getSessionKey(wsPlayerId: WebSocketId): SessionKey | undefined {
    return this._sessionKeys.get(wsPlayerId);
  }

  /**
   * Finds the current WebSocket ID of the player holding the given session key.
   * Returns `undefined` when the key is not recognised.
   */
  public findPlayerBySessionKey(
    sessionKey: SessionKey,
  ): WebSocketId | undefined {
    for (const [wsPlayerId, key] of this._sessionKeys) {
      if (key === sessionKey) {
        return wsPlayerId;
      }
    }
    return undefined;
  }

  /**
   * Replaces a player's WebSocket ID after they reconnect with a new connection.
   * Updates the player map, pending execute map, and session key map.
   */
  public updatePlayerId(oldId: WebSocketId, newId: WebSocketId): void {
    const playerEntity = this._playerMap.get(oldId);
    if (playerEntity === undefined) {
      return;
    }
    this._playerMap.delete(oldId);
    this._playerMap.set(newId, playerEntity);

    const pendingExecute = this._pendingExecute.get(oldId);
    if (pendingExecute !== undefined) {
      this._pendingExecute.delete(oldId);
      this._pendingExecute.set(newId, pendingExecute);
    }

    const sessionKey = this._sessionKeys.get(oldId);
    if (sessionKey !== undefined) {
      this._sessionKeys.delete(oldId);
      this._sessionKeys.set(newId, sessionKey);
    }
  }

  /** Returns all current WebSocket player IDs in this session. */
  public playerIds(): ReadonlyArray<WebSocketId> {
    return [...this._playerMap.keys()];
  }

  /** Returns `true` when the game has ended and the session is awaiting restart votes or cleanup. */
  public isEnded(): boolean {
    return this._gameEnded;
  }

  /** Marks the session as ended (called by the server's onEnd callback). */
  public markEnded(): void {
    this._gameEnded = true;
  }

  /**
   * Records a restart vote from the given player.
   * Returns `true` when every player has voted and a restart should begin.
   */
  public voteRestart(wsPlayerId: WebSocketId): boolean {
    if (!this._gameEnded) return false;
    if (!this._playerMap.has(wsPlayerId)) return false;
    this._pendingRestartVotes.add(wsPlayerId);
    return this._pendingRestartVotes.size === this._playerMap.size;
  }

  /**
   * Restarts the session with a fresh game instance.
   * Remaps player entities, resets pending state, sends SETUP to each player,
   * then re-registers callbacks so the new game begins immediately.
   *
   * @param createGame Factory that returns a new `Game` instance.
   * @param onEnd      Callback registered on the new game's `onEnd` hook.
   */
  public async restart(
    createGame: () => Game<any>,
    onEnd: () => void,
  ): Promise<void> {
    const newGame = createGame();
    const oldPlayers = this._game.players();
    const newPlayers = newGame.players();

    // Remap _playerMap entries to the new game's player entities (same index).
    for (const [wsPlayerId, oldEntity] of this._playerMap) {
      const index = oldPlayers.indexOf(oldEntity);
      if (index !== -1 && index < newPlayers.length) {
        this._playerMap.set(wsPlayerId, newPlayers[index]!);
      }
    }

    this._game = newGame;
    this._pendingExecute.clear();
    this._pendingRestartVotes.clear();
    this._gameEnded = false;

    newGame.registerCallbacks({ onEnd });

    // Send SETUP before registering callbacks so the client initialises before
    // the first STATE arrives.
    for (const [wsPlayerId, playerEntity] of this._playerMap) {
      const playerIndex = this._game.players().indexOf(playerEntity);
      this._send(wsPlayerId, { type: 'SETUP', payload: { playerIndex } });
    }

    await this.start();
  }

  /**
   * Registers player callbacks for every participant.
   * The underlying `Game` starts automatically once all callbacks are registered.
   */
  public async start(): Promise<void> {
    for (const [wsPlayerId, playerEntity] of this._playerMap) {
      await this._game.registerPlayerCallback(
        playerEntity,
        this._callbackFor(wsPlayerId),
      );
    }
  }

  /**
   * Re-registers a player's callback, causing the game to re-deliver their
   * current state snapshot. Useful after a client reconnects or explicitly
   * requests a state refresh.
   *
   * @param wsPlayerId  The WebSocket player ID requesting the state refresh.
   */
  public async requestState(wsPlayerId: WebSocketId): Promise<void> {
    const playerEntity = this._playerMap.get(wsPlayerId);
    if (playerEntity === undefined) {
      return;
    }
    const playerIndex = this._game.players().indexOf(playerEntity);
    this._send(wsPlayerId, { type: 'SETUP', payload: { playerIndex } });
    await this._game.registerPlayerCallback(
      playerEntity,
      this._callbackFor(wsPlayerId),
    );
  }

  /**
   * Routes an incoming choice to the game engine.
   * Returns `false` when the player has no pending prompt (e.g. it is not
   * their turn or the choice arrived out of order).
   *
   * @param wsPlayerId  The WebSocket player ID submitting the choice.
   * @param choiceId    The numeric choice ID received from the client.
   */
  public handleChoice(wsPlayerId: WebSocketId, choiceId: ChoiceId): boolean {
    const execute = this._pendingExecute.get(wsPlayerId);
    if (execute === undefined) {
      return false;
    }
    this._pendingExecute.delete(wsPlayerId);
    execute(choiceId);
    return true;
  }

  /**
   * Recursively replaces `Entity` instances in action parameters with
   * `$ENGINE:<id>` placeholder strings so they survive JSON serialisation.
   * The client's `resolveParams` function reconstructs entity stubs from
   * these placeholders.
   */
  private static _serializeParams(value: unknown): unknown {
    if (value instanceof Entity) {
      return `$ENGINE:${value[entityId]}`;
    }
    if (Array.isArray(value)) {
      return value.map((v) => GameSession._serializeParams(v));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          GameSession._serializeParams(v),
        ]),
      );
    }
    return value;
  }

  /**
   * Builds a `PlayerInterfaceCallback` that forwards game events (state
   * snapshots and choice prompts) to the client identified by `wsPlayerId`.
   */
  private _callbackFor(wsPlayerId: WebSocketId): PlayerInterfaceCallback {
    return {
      state: (snapshots: Snapshot[]) => {
        const serialized = snapshots.map((s) => ({
          dirtyEntities: s.dirtyEntities,
          executed:
            s.executed !== undefined
              ? {
                  $type: s.executed.$type,
                  parameters: GameSession._serializeParams(
                    s.executed.parameters,
                  ),
                }
              : undefined,
        }));
        this._send(wsPlayerId, {
          type: 'STATE',
          payload: { state: serialized },
        });
      },
      prompt: (
        choices: EnhancedChoice<Action<string, any, any>>[],
        execute,
      ) => {
        this._pendingExecute.set(wsPlayerId, execute);
        this._send(wsPlayerId, {
          type: 'CHOICES',
          payload: { choices },
        });
      },
    };
  }
}
