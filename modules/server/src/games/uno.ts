import { join } from 'path';
import { Uno } from '../../../library/tests/uno/uno';
import type { ServerGameConfig } from '../server.types';

export const unoConfig: ServerGameConfig = {
  name: 'Uno',
  slug: 'uno',
  clientEntry: join(
    import.meta.dir,
    '../../../client-singleplayer/examples/uno/index.ts',
  ),
  clientStyles: join(
    import.meta.dir,
    '../../../client-singleplayer/examples/uno/index.css',
  ),
  singleplayerHtml: join(
    import.meta.dir,
    '../../../client-singleplayer/examples/uno/index.html',
  ),
  playerCount: 2,
  createGame: () => new Uno({ playerSize: 2 }),
};
