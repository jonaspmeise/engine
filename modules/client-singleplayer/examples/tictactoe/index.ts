import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { TicTacToeClient } from './tictactoe-client';
import { Players } from '@my-engine/library';

// Setting up the game.
const game = new TicTacToe({
  firstPlayer: 'X',
});

game.registerPlayerCallback(
  game.players()![0],
  Players.mcts(game, game.players()![0]!),
);

const client = new TicTacToeClient(game.players()![1]);
game.registerPlayerCallback(
  game.players()![1],
  (snapshots, choices, execute) => {
    client.feed(snapshots, choices, execute);
  },
);
