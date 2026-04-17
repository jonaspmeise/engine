import {
  Action,
  Entity,
  ModifiableRuntime,
  QueryableRuntime,
} from '../../../src';
import { UnoDeck } from '../entities/deck';
import { UnoDiscardPile } from '../entities/discard-pile';

export class UnoDealTopCardAction extends Action<'deal_top_card'> {
  public affectedEntities(_runtime: QueryableRuntime): Entity[] | void {
    // Not needed, because the player never executes this.
  }

  public async doApply(runtime: ModifiableRuntime): Promise<void> {
    const deck = runtime.anyEntity(UnoDeck)!;
    const discardPile = runtime.anyEntity(UnoDiscardPile)!;
    const topCard = deck.cards(runtime).at(-1);
    if (!topCard) {
      return;
    }

    topCard.location = discardPile;
    topCard.position = discardPile.cards(runtime).length;
  }

  public $type: 'deal_top_card' = 'deal_top_card';
}
