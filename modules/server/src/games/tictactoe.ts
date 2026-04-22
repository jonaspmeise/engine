import { join } from 'path';
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import type { ServerGameConfig } from '../server.types';

export const tictactoeConfig: ServerGameConfig = {
  name: 'Tic-Tac-Toe',
  slug: 'tictactoe',
  clientEntry: join(
    import.meta.dir,
    '../../../client-singleplayer/examples/tictactoe/index.ts',
  ),
  multiplayerClientEntry: join(
    import.meta.dir,
    '../../../client-singleplayer/examples/tictactoe/tictactoe-multiplayer.ts',
  ),
  singleplayerHtml: join(
    import.meta.dir,
    '../../../client-singleplayer/examples/tictactoe/index.html',
  ),
  playerCount: 2,
  createGame: () => new TicTacToe({ firstPlayer: 'X' }),
};
