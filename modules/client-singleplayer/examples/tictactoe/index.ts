/// <reference lib="dom" />
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { TicTacToePlayer } from '../../../library/tests/tictactoe/entities/player';
import { Players } from '@my-engine/library';
import { TicTacToeClient } from './tictactoe-client';
import { startSingleplayer } from '../../src/client-config';

startSingleplayer({
  createGame: () => new TicTacToe({ firstPlayer: 'X' }),
  humanPlayerIndex: 1,
  createClient: (entityClassMapping, player) => {
    return new TicTacToeClient(entityClassMapping, player as TicTacToePlayer);
  },
  singleplayer: {
    Chicken: (_game, _player) => Players.chicken(),
    Impossible: (game, player) => Players.mcts(game, player, 1000),
  },
  multiplayer: true,
});
