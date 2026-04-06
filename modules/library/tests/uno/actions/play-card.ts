import {
  Action,
  Entity,
  ModifiableRuntime,
  QueryableRuntime,
} from '../../../src';
import { UnoCard } from '../entities/card';
import { UnoDiscardPile } from '../entities/discard-pile';

export class UnoPlayCardAction extends Action<'play_card', { card: UnoCard }> {
  async doApply(runtime: ModifiableRuntime): Promise<void> {
    const card = this.parameters.card;

    const discardPile = runtime.anyEntity(UnoDiscardPile)!;
    card.location = discardPile;
    card.position = discardPile.cards(runtime).length;

    // Accumulate forced draw cards for the next player.
    await card.onPlay(runtime);
  }

  public $type: 'play_card' = 'play_card';

  public message(): string {
    return `${this.parameters.card} was played.`;
  }

  public prompt(): string {
    return `Play ${this.parameters.card}.`;
  }

  public affectedEntities(_runtime: QueryableRuntime): Entity[] | void {
    return [this.parameters.card];
  }
}
