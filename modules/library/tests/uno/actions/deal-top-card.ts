import {
  Action,
  Entity,
  ModifiableRuntime,
  QueryableRuntime,
} from '../../../src';
import { UnoDeck } from '../entities/deck';
import { UnoDiscardPile } from '../entities/discard-pile';
import { UnoPutDiscardPileAction } from './put-discardpile';

export class UnoDealTopCardAction extends Action<'deal_top_card'> {
  public affectedEntities(_runtime: QueryableRuntime): Entity[] | void {
    // Not needed, because the player never executes this.
  }

  public async doApply(runtime: ModifiableRuntime): Promise<void> {
    const deck = runtime.anyEntity(UnoDeck)!;
    const topCard = deck.cards(runtime).at(-1);
    // TODO: Fix
    if (!topCard) {
      return;
    }

    await runtime.execute(
      new UnoPutDiscardPileAction({
        card: topCard,
      }),
    );
  }

  public $type: 'deal_top_card' = 'deal_top_card';
}
