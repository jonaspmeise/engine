import { randomChickenPlayer } from '@my-engine/library';
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { TicTacToeClient } from './tictactoe-client';
// Setting up the game.

const game = new TicTacToe({
  firstPlayer: 'X',
});

game.registerPlayerCallback(game.players()![0], randomChickenPlayer());

const client = new TicTacToeClient();
game.registerPlayerCallback(
  game.players()![1],
  (snapshots, choices, execute) => {
    client.feed(snapshots, choices, execute);
  },
);
