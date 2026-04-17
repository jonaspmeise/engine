import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { TicTacToeClient } from './tictactoe-client';
import { Players } from '@my-engine/library';

function startGame(): void {
  const game = new TicTacToe({
    firstPlayer: 'X',
  });

  const mctsPlayer = game.players()![0]!;
  game.registerPlayerCallback(
    mctsPlayer,
    Players.mcts(game, mctsPlayer, 1000, console),
    // Players.chicken(() => Math.random() * 500 + 500),
  );

  const humanPlayer = game.players()![1]!;
  const client = new TicTacToeClient(humanPlayer);
  game.registerPlayerCallback(humanPlayer, {
    prompt: (choices, execute) => {
      client.feedChoices(choices, execute);
    },
    state: (snapshots) => {
      client.feedSnapshots(snapshots);
    },
  });
}

document
  .getElementById('tic-tac-toe-target')!
  .addEventListener('game:reset', () => startGame());

startGame();
