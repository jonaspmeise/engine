/// <reference lib="dom" />
import type { Client } from './client';
import { MultiplayerSession } from './multiplayer-session';

/**
 * Wires a multiplayer game client to a {@link MultiplayerSession} and starts
 * the connection — the batteries-included entry point for multiplayer clients.
 *
 * The provided `createClient` factory is called every time the server sends a
 * `SETUP` message (once at the start of each game, including restarts). The
 * factory receives the zero-based player index assigned by the server and must
 * return a fully constructed `Client` instance ready to receive state and
 * choices. Any DOM teardown needed between games (e.g. clearing a render
 * target) should be performed inside the factory before constructing the
 * client.
 *
 * End-of-game navigation is handled automatically:
 * - **"Play Again"** sends a `PLAY_AGAIN` vote to the server.
 * - **"Cancel"** navigates to `/`.
 *
 * @example
 * ```ts
 * // tictactoe-multiplayer.ts
 * import { startMultiplayerClient } from '@my-engine/client-singleplayer';
 * import { TicTacToe } from '…/tictactoe';
 * import { TicTacToeClient } from './tictactoe-client';
 *
 * startMultiplayerClient((playerIndex) => {
 *   const game = new TicTacToe({ firstPlayer: 'X' });
 *   document.getElementById('tic-tac-toe-target')!.replaceChildren();
 *   return new TicTacToeClient(game.players()[playerIndex]!);
 * });
 * ```
 */
export function startMultiplayerClient<
  TClient extends Client<HTMLElement, any>,
>(createClient: (playerIndex: number) => TClient): void {
  let client: TClient | null = null;
  const session = new MultiplayerSession();

  session
    .onSetup((playerIndex) => {
      client = createClient(playerIndex);
      client.onResultChoice = (result) => {
        if (result === 'restart') {
          session.playAgain();
        } else {
          window.location.href = '/';
        }
      };
    })
    .onState((snapshots) => {
      client?.feedSnapshots(snapshots);
    })
    .onChoices((choices, execute) => {
      client?.feedChoices(choices, (choice) => {
        execute(typeof choice === 'number' ? choice : choice.id);
      });
    })
    .onGameOver(() => {
      // Navigation and restart are handled by the result overlay
      // via the onResultChoice hook set in onSetup.
    });
}
