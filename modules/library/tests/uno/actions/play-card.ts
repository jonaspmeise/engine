import { Action } from '../../../src';
import { GraphRuntime } from '../../../src/game/graph-runtime';
import { UnoCard } from '../entities/card';
import { UnoDiscardPile } from '../entities/discard-pile';

export class UnoPlayCardAction extends Action<'play_card', { card: UnoCard }> {
  async doApply(runtime: GraphRuntime): Promise<void> {
    const card = this.parameters.card;

    const discardPile = runtime.anyEntity(UnoDiscardPile)!;
    card.location = discardPile;
    card.position = discardPile.cards(runtime).length;

    // Accumulate forced draw cards for the next player.
    await card.onPlay(runtime);
  }

  public $type: 'play_card' = 'play_card';
}
