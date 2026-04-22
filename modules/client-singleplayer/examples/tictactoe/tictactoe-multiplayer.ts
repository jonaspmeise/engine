/// <reference lib="dom" />
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { TicTacToeClient } from './tictactoe-client';
import { MultiplayerSession } from '../../src/multiplayer-session';

// A shared game instance used to retrieve the correct PlayerInterface
// once the server sends SETUP telling us which player index we are.
const game = new TicTacToe({ firstPlayer: 'X' });
let client: TicTacToeClient | null = null;

const session = new MultiplayerSession();
session
  .onSetup((playerIndex) => {
    const player = game.players()[playerIndex]!;
    client = new TicTacToeClient(player);
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
    client?.clear();
    window.location.href = '/';
  });
