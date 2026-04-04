import { Game } from '../../src';
import { BaseGameTest } from '../game.spec';
import { Uno } from './uno';

export class UnoTest extends BaseGameTest<{
  playerSize: number;
}> {
  numberOfPlayers: number = 4; // TODO: Make this initializable!
  initializer: (parameters: {
    playerSize: number;
  }) => Game<{ playerSize: number }> = (parameters) => new Uno(parameters);
  name: string = 'Uno';

  parameters = {
    playerSize: 4,
  };

  randomPlayDepth: number = 100;

  additionalTests(): void {
    // No additional tests yet.
  }
}

new UnoTest().run();
