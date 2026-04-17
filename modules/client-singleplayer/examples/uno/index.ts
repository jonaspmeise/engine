import { DEFAULT_LOGGER, Players } from '@my-engine/library';
import { UnoClient } from './uno-client';
import { Uno } from '../../../library/tests/uno/uno';

const PLAYER_SIZE = 4;
const HUMAN_PLAYER_INDEX = 1;

function startGame(): void {
  const game = new Uno({ playerSize: PLAYER_SIZE });

  // Register AI players for every slot except the human's.
  for (let i = 0; i < PLAYER_SIZE; i++) {
    if (i === HUMAN_PLAYER_INDEX) continue;
    game.registerPlayerCallback(
      game.players()![i]!,
      Players.chicken(
        () => Math.random() * 1000 + 500,
        DEFAULT_LOGGER,
        `Player ${i + 1}`,
      ),
    );
  }

  // Register the human player last so the game starts once all players are connected.
  const humanPlayer = game.players()![HUMAN_PLAYER_INDEX]!;
  const client = new UnoClient(humanPlayer, PLAYER_SIZE);
  game.registerPlayerCallback(humanPlayer, {
    state: (snapshots) => {
      client.feedSnapshots(snapshots);
    },
    prompt: (choices, execute) => {
      client.feedChoices(choices, execute);
    },
  });
}

document
  .getElementById('uno-target')!
  .addEventListener('game:reset', () => startGame());

startGame();
