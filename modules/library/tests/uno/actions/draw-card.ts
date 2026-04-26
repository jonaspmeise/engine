import { Action, ModifiableRuntime } from '../../../src';
import { UnoCard } from '../entities/card';
import { UnoDeck } from '../entities/deck';
import { UnoPlayer } from '../entities/player';

export class UnoDrawCardAction extends Action<
  'draw_card',
  {
    amount: number;
    player: UnoPlayer;
  },
  {
    drawn: UnoCard[];
  }
> {
  public async doApply(
    runtime: ModifiableRuntime,
  ): Promise<{ drawn: UnoCard[] }> {
    const hand = this.parameters.player.hand(runtime);
    const deck = runtime.anyEntity(UnoDeck)!;

    const drawn: UnoCard[] = [];
    for (let i = 0; i < this.parameters.amount; i++) {
      let card = deck.cards(runtime).pop()!;

      card.location = hand;
      card.position = hand.cards(runtime).length + 1; // Slide in on one side of the hand.
      drawn.push(card);
    }

    return { drawn };
  }
  public $type: 'draw_card' = 'draw_card';
}
