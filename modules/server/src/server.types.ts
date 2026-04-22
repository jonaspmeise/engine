import type { Game } from '@my-engine/library';

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

export type ServerGameConfig = {
  /** Display name shown in the menu and page title. */
  readonly name: string;
  /** URL slug (e.g. 'tictactoe'). Used to identify the game on the CLI. */
  readonly slug: string;
  /**
   * Absolute path to the game's client entry TypeScript file.
   * Bun bundles this for the browser at server startup.
   */
  readonly clientEntry: string;
  /**
   * Absolute path to the game's CSS file.
   * Served at /game.css and applied to both the singleplayer page and the
   * main menu for a consistent look & feel.
   * When absent, /game.css returns an empty response.
   */
  readonly clientStyles?: string;
  /**
   * Absolute path to the game's existing singleplayer HTML file.
   * The server adapts this HTML for browser-based singleplayer: it replaces
   * local asset paths with server routes and injects a navigation override so
   * that "Play Again?" returns the player to the main menu.
   */
  readonly singleplayerHtml: string;
  /**
   * Absolute path to a TypeScript entry file for the multiplayer client.
   * When provided, the server also bundles this as `/multiplayer-game.js`
   * and serves a `/multiplayer` page that loads it instead of the singleplayer
   * bundle. The entry is expected to create a {@link MultiplayerSession} and
   * wire it to a game client instance.
   */
  readonly multiplayerClientEntry?: string;
  /** Number of players required to fill a lobby and start a multiplayer session. */
  readonly playerCount: number;
  /**
   * Factory that creates a fresh game instance.
   * Called once per lobby when it reaches {@link playerCount} players.
   */
  readonly createGame: () => Game<any>;
};

export type ServerOptions = {
  readonly port?: number;
};
