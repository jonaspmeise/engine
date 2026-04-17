import { Action, ModifiableRuntime } from '../../../src';
import { UnoCard } from '../entities/card';
import { UnoDeck } from '../entities/deck';
import { UnoDiscardPile } from '../entities/discard-pile';
import { UnoPlayer } from '../entities/player';
import { UnoShuffleAction } from './shuffle';

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

    if (deck.cards(runtime).length < this.parameters.amount) {
      // Shuffle discard pile into deck.
      // TODO: This should be its own action, but how would we execute this "inside" our current action...?
      const discardPile = runtime.anyEntity(UnoDiscardPile)!.cards(runtime);
      discardPile.forEach((card) => {
        card.location = deck;
        card.position = 0;
      });
    }

    const drawn: UnoCard[] = [];
    for (let i = 0; i < this.parameters.amount; i++) {
      let card = deck.cards(runtime).pop();

      if (!card) {
        new UnoShuffleAction({
          from: runtime.anyEntity(UnoDiscardPile)!,
          to: deck,
        }).apply(runtime);

        card = deck.cards(runtime).pop()!;
      }

      card.location = hand;
      card.position = hand.cards(runtime).length; // Slide in on one side of the hand.
    }

    return { drawn };
  }
  public $type: 'draw_card' = 'draw_card';
}
