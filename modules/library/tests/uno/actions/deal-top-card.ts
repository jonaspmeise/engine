import {
  Action,
  EntityID,
  ModifiableRuntime,
  QueryableRuntime,
} from '../../../src';
import { UnoDeck } from '../entities/deck';
import { UnoDiscardPile } from '../entities/discard-pile';

export class UnoDealTopCardAction extends Action<'deal_top_card'> {
  public affectedEntities(_runtime: QueryableRuntime): EntityID[] | void {
    // Not needed, because the player never executes this.
  }

  apply(runtime: ModifiableRuntime): void {
    const deck = runtime.anyEntity(UnoDeck)!;
    const discardPile = runtime.anyEntity(UnoDiscardPile)!;
    const topCard = deck.cards(runtime).at(-1);
    if (!topCard) {
      return;
    }

    topCard.location = discardPile;
    topCard.position = discardPile.cards(runtime).length;
  }

  public message(): string {
    return 'Top card flipped to discard pile.';
  }

  public prompt(): string {
    return 'Flip top card.';
  }

  public $type: 'deal_top_card' = 'deal_top_card';
}
