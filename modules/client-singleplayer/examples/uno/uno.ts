/// <reference lib="dom" />
import { Uno } from '../../../library/tests/uno/uno';
import { DEFAULT_LOGGER, Players } from '@my-engine/library';
import { UnoClient } from './uno-client';
import { startSingleplayer } from '../../src/client-config';

const PLAYER_SIZE = 4;

startSingleplayer({
  createGame: () => new Uno({ playerSize: PLAYER_SIZE }),
  humanPlayerIndex: 1,
  createClient: (game, playerIndex) => {
    const renderTarget = document.getElementById(
      'uno-target',
    ) as HTMLDivElement;
    // renderTarget.replaceChildren();
    return new UnoClient(game.players()[playerIndex]!, PLAYER_SIZE);
  },
  singleplayer: {
    Chicken: (_game, player) =>
      Players.chicken(
        () => Math.random() * 1000 + 500,
        DEFAULT_LOGGER,
        player.toString(),
      ),
  },
});
