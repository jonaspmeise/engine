import type {
  Action,
  ChoiceId,
  EnhancedChoice,
  Game,
  PlayerEntity,
  PlayerInterfaceCallback,
  Snapshot,
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

  /**
   * @param _game       The game instance managed by this session.
   * @param playerMap   Maps each WebSocket player ID to its corresponding
   *                    `PlayerEntity` inside the game.
   * @param _send       Callback used to push `ServerMessage`s to a specific client.
   */
  constructor(
    private readonly _game: Game<any>,
    playerMap: ReadonlyMap<WebSocketId, PlayerEntity>,
    private readonly _send: SessionSendFn,
  ) {
    this._playerMap = new Map(playerMap);
    this._sessionKeys = new Map(
      [...playerMap.keys()].map((id) => [id, crypto.randomUUID() as SessionKey]),
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
  public findPlayerBySessionKey(sessionKey: SessionKey): WebSocketId | undefined {
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
   * Builds a `PlayerInterfaceCallback` that forwards game events (state
   * snapshots and choice prompts) to the client identified by `wsPlayerId`.
   */
  private _callbackFor(wsPlayerId: WebSocketId): PlayerInterfaceCallback {
    return {
      state: (snapshots: Snapshot[]) => {
        this._send(wsPlayerId, {
          type: 'STATE',
          payload: { state: snapshots },
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
