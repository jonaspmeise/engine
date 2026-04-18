import { ModifiableRuntime } from '../../../src';
import { BeforeAction } from '../../../src/components/lifecyclehooks';
import { UnoDrawCardAction } from '../actions/draw-card';
import { UnoShuffleAction } from '../actions/shuffle';
import { UnoDiscardPile } from './discard-pile';
import { UnoPlayer } from './player';
import { UnoZone } from './zone';

export class UnoDeck
  extends UnoZone
  implements BeforeAction<UnoDrawCardAction>
{
  public $type: string = 'Deck';

  constructor() {
    super('deck');
  }

  beforeDraw_card(
    runtime: ModifiableRuntime,
    parameters: { amount: number; player: UnoPlayer },
  ): boolean | void {
    // Before a player draws cards, we check if the deck has enough cards.
    // If not, we shuffle the discard pile into the deck.

    if (this.cards(runtime).length < parameters.amount) {
      const discardPile = runtime.anyEntity(UnoDiscardPile);

      runtime.execute(
        new UnoShuffleAction({
          from: discardPile!,
          to: this,
        }),
      );
    }
  }

  public toString(): string {
    return 'Deck';
  }
}
