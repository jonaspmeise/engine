import {
  Action,
  entityId,
  EntityID,
  ModifiableRuntime,
  QueryableRuntime,
} from '../../../src';
import { UnoCard } from '../entities/card';
import { UnoDiscardPile } from '../entities/discard-pile';

export class UnoPlayCardAction extends Action<'play_card', { card: UnoCard }> {
  apply(runtime: ModifiableRuntime): void {
    const card = this.parameters.card;

    const discardPile = runtime.anyEntity(UnoDiscardPile)!;
    card.location = discardPile;
    card.position = discardPile.cards(runtime).length; // top of the pile!
  }

  public $type: 'play_card' = 'play_card';

  public message(): string {
    return `${this.parameters.card} was played.`;
  }

  public prompt(): string {
    return `Play ${this.parameters.card}.`;
  }

  public affectedEntities(_runtime: QueryableRuntime): EntityID[] | void {
    return [this.parameters.card[entityId]];
  }
}
