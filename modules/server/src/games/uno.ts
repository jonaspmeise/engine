import { join } from 'path';
import { Uno } from '../../../library/tests/uno/uno';
import { GameServer, buildBundle } from '../server';
import type { Server } from '../server.types';

const [clientBundle, html, styles] = await Promise.all([
  buildBundle(join(import.meta.dir, '../../../client-singleplayer/examples/uno/uno.ts')),
  Bun.file(join(import.meta.dir, '../../../client-singleplayer/examples/uno/index.html')).text(),
  Bun.file(join(import.meta.dir, '../../../client-singleplayer/examples/uno/index.css')).text(),
]);

export const UnoServer: Server = {
  name: 'Uno',
  playerCount: 2,
  createGame: () => new Uno({ playerSize: 2 }),
  multiplayer: {
    mode: 'lobby',
  },
  files: {
    client: clientBundle,
    html,
    styles,
  },
};

if (import.meta.main) {
  await new GameServer(UnoServer).run();
}

