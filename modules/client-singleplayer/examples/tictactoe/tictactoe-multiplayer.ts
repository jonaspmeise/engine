/// <reference lib="dom" />
import { startMultiplayerClient } from '../../src/multiplayer-client';
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { TicTacToeClient } from './tictactoe-client';

startMultiplayerClient((playerIndex) => {
  const game = new TicTacToe({ firstPlayer: 'X' });
  const renderTarget = document.getElementById(
    'tic-tac-toe-target',
  ) as HTMLDivElement;
  renderTarget.replaceChildren();
  return new TicTacToeClient(game.players()[playerIndex]!);
});
