import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { DEFAULT_LOGGER, Players } from '@my-engine/library';
import { UnoClient } from './uno-client';
import { Uno } from '../../../library/tests/uno/uno';

function startGame(): void {
  const playerSize = 4;
  const game = new Uno({
    playerSize: playerSize,
  });

  for (let i = 0; i < playerSize; i++) {
    const player = game.players()![i]!;
    game.registerPlayerCallback(
      player,
      Players.chicken(
        () => Math.random() * 1000 + 500,
        DEFAULT_LOGGER,
        `Player ${i + 1}`,
      ),
    );
  }

  const humanPlayer = game.players()![1]!;
  const client = new UnoClient(humanPlayer, playerSize);
  game.registerPlayerCallback(humanPlayer, (snapshots, choices, execute) => {
    client.feed(snapshots, choices, execute);
  });
}

document
  .getElementById('uno-target')!
  .addEventListener('game:reset', () => startGame());

startGame();
