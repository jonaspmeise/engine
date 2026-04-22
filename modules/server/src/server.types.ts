import type { Game, PlayerInterfaceCallback, PlayerEntity, GameEndParameters } from '@my-engine/library';

/**
 * Opaque identifier for an active WebSocket connection.
 * Created once per connection as a UUID and used as the pub/sub topic.
 */
export type WebSocketId = string & { readonly _brand: 'WebSocketId' };

/**
 * Opaque per-player token issued when a game session starts.
 * Stored by the client and sent on reconnection to re-authenticate.
 */
export type SessionKey = string & { readonly _brand: 'SessionKey' };

/**
 * Configuration object that fully describes a hosted game.
 *
 * The optional generic parameter `TLobbyData` lets game devs declare what
 * extra data each player may submit when creating or joining a lobby —
 * e.g. `{ preferredSymbol: 'X' | 'O' }` for Tic-Tac-Toe, or a custom deck
 * for a card game. When no per-player data is needed, omit the parameter
 * or pass `void`.
 */
export type GameServerConfig<TLobbyData = void> = {
  /** Human-readable display name shown in the main menu and page title. */
  readonly name: string;
  /** Number of players required to fill a lobby and start a session. */
  readonly playerCount: number;
  /**
   * Factory that creates a fresh game instance.
   * Receives per-player lobby data in lobby join-order.
   * When `TLobbyData` is `void`, the array is ignored and the factory
   * can simply take no arguments.
   */
  readonly createGame: (playersData: TLobbyData[]) => Game<any>;
  /**
   * Named AI opponents available in singleplayer mode.
   * Each entry maps a display name to a factory that produces a
   * `PlayerInterfaceCallback` for that AI. Reserved for future server-side AI support.
   */
  readonly singleplayer?: Record<
    string,
    (game: Game<any>, player: PlayerEntity) => PlayerInterfaceCallback
  >;
  /** Multiplayer lobby configuration. */
  readonly multiplayer?: {
    readonly mode: 'lobby' | 'matchmaking';
  };
  /** Lifecycle callbacks invoked by the server during a game session. */
  readonly callbacks?: {
    readonly onEnd?: (status: GameEndParameters) => void;
  };
  /** Paths to the game assets bundled or served at startup. */
  readonly files: {
    /** Pre-built browser JS bundle served at `/game.js` for both singleplayer and multiplayer. */
    readonly client: string;
    /** HTML page content for the singleplayer route. */
    readonly html: string;
    /**
     * CSS content served at `/game.css`.
     * Applied to both the singleplayer and multiplayer pages.
     */
    readonly styles?: string;
  };
};

/** Convenience alias when no per-player lobby data is needed. */
export type ServerGameConfig = GameServerConfig<void>;

/** Short alias for {@link GameServerConfig}. */
export type Server<TLobbyData = void> = GameServerConfig<TLobbyData>;

export type ServerOptions = {
  readonly port?: number;
};
