/// <reference lib="dom" />
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { Players } from '@my-engine/library';
import { TicTacToeClient } from './tictactoe-client';
import { startSingleplayer } from '../../src/client-config';

startSingleplayer({
  createGame: () => new TicTacToe({ firstPlayer: 'X' }),
  humanPlayerIndex: 1,
  createClient: (game, playerIndex) => {
    const renderTarget = document.getElementById(
      'tic-tac-toe-target',
    ) as HTMLDivElement;
    // renderTarget.replaceChildren();
    return new TicTacToeClient(game.players()[playerIndex]!);
  },
  singleplayer: {
    Chicken: (_game, _player) => Players.chicken(),
    Impossible: (game, player) => Players.mcts(game, player, 1000),
  },
  multiplayer: true,
});
