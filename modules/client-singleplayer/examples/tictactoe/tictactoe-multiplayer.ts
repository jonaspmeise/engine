/// <reference lib="dom" />
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { TicTacToeClient } from './tictactoe-client';
import { MultiplayerSession } from '../../src/multiplayer-session';

// A shared game instance used to retrieve the correct PlayerInterface
// once the server sends SETUP telling us which player index we are.
const game = new TicTacToe({ firstPlayer: 'X' });
let client: TicTacToeClient | null = null;

const session = new MultiplayerSession();

function attachClient(playerIndex: number): void {
  const player = game.players()[playerIndex]!;
  // Clear the board DOM so a fresh game renders cleanly (avoids stale
  // slot classes from a previous game without firing the game:reset event).
  const renderTarget = document.getElementById(
    'tic-tac-toe-target',
  ) as HTMLDivElement;
  renderTarget.replaceChildren();

  client = new TicTacToeClient(player);
  client.onResultChoice = (result) => {
    if (result === 'restart') {
      session.playAgain();
    } else {
      window.location.href = '/';
    }
  };
}

session
  .onSetup((playerIndex) => {
    attachClient(playerIndex);
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
    // Navigation / restart is handled by the result overlay (onResultChoice).
    // The session key has already been cleared by MultiplayerSession.
  });
