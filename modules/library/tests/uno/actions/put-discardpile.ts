import { Action, ModifiableRuntime } from '../../../src';
import { UnoCard } from '../entities/card';
import { UnoDiscardPile } from '../entities/discard-pile';

export class UnoPutDiscardPileAction extends Action<
  'put_discard_pile',
  { card: UnoCard }
> {
  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    const card = this.parameters.card;
    const discardPile = runtime.anyEntity(UnoDiscardPile)!;

    card.location = discardPile;
    card.position = discardPile.cards(runtime).length + 1;
  }
  public $type: 'put_discard_pile' = 'put_discard_pile';
}
