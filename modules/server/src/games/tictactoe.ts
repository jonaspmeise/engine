import { join } from 'path';
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { Players } from '@my-engine/library';
import { GameServer, buildBundle } from '../server';
import type { Server } from '../server.types';

const [clientBundle, html] = await Promise.all([
  buildBundle(
    join(
      import.meta.dir,
      '../../../client-singleplayer/examples/tictactoe/tictactoe.ts',
    ),
  ),
  Bun.file(
    join(
      import.meta.dir,
      '../../../client-singleplayer/examples/tictactoe/index.html',
    ),
  ).text(),
]);

export const TicTacToeServer: Server = {
  name: 'Tic-Tac-Toe',
  playerCount: 2,
  createGame: () => new TicTacToe({ firstPlayer: 'X' }),
  singleplayer: {
    Chicken: (_game, _player) => Players.chicken(),
    Impossible: (game, player) => Players.mcts(game, player, 1000),
  },
  multiplayer: {
    mode: 'lobby',
  },
  callbacks: {
    onEnd: (status) => {
      console.log(
        'Game ended with winners:',
        status.winners.map((p) => p.toString()),
      );
    },
  },
  files: {
    client: clientBundle,
    html,
  },
};

if (import.meta.main) {
  await new GameServer(TicTacToeServer).run();
}
