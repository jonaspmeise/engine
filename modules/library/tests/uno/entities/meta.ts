import { Entity, ModifiableRuntime } from '../../../src';
import { AfterAction } from '../../../src/components/lifecyclehooks';
import { UnoPlayCardAction } from '../actions/play-card';
import { UnoWinGameAction } from '../actions/win-game';
import { UnoPlayer } from './player';

/**
 * A "meta" entity that stores global data about the game.
 * This entity only exists as a singleton.
 */
export class UnoMeta extends Entity implements AfterAction<UnoPlayCardAction> {
  public $type: string = 'Meta';

  public drawOverloads: number = 0;
  public currentPlayerIndex: number = 0;
  public direction: 1 | -1 = 1;

  constructor(public players: UnoPlayer[]) {
    super('meta');
  }

  public toString(): string {
    return `Meta`;
  }

  public currentPlayer() {
    return this.players[this.currentPlayerIndex]!;
  }

  async afterPlay_card(runtime: ModifiableRuntime) {
    // After a card is played, we check for a win here.
    const player = this.currentPlayer()!;
    if (player.hand(runtime).cards(runtime).length === 0) {
      await runtime.execute(
        new UnoWinGameAction({
          player: player,
        }),
      );
    }
  }
}
