import {
  Action,
  entityId,
  EntityID,
  ModifiableRuntime,
  PlayerEntity,
  QueryableRuntime,
} from '../../../src';
import { UnoDeck } from '../entities/deck';
import { UnoPlayer } from '../entities/player';

export class UnoDrawCardAction extends Action<
  'draw_card',
  {
    amount: number;
    player: UnoPlayer;
  }
> {
  apply(runtime: ModifiableRuntime): void {
    const hand = this.parameters.player.hand(runtime);
    const deck = runtime.anyEntity(UnoDeck)!;

    for (let i = 0; i < this.parameters.amount; i++) {
      const card = deck.cards(runtime).pop();

      if (!card) {
        throw new Error('Deck is empty! Cannot draw a card.'); // TODO: Implement shuffling.
      }

      card.location = hand;
      card.position = hand.cards(runtime).length; // Slide in on one side of the hand.
    }
  }
  public $type: 'draw_card' = 'draw_card';

  public message(_player: PlayerEntity): string {
    return `Player ${this.parameters.player} draws ${this.parameters.amount} card${this.parameters.amount > 1 ? 's' : ''}.`;
  }
  public prompt(): string {
    throw new Error(
      `Draw ${this.parameters.amount} card${this.parameters.amount > 1 ? 's' : ''}.`,
    );
  }
  public affectedEntities(runtime: QueryableRuntime): EntityID[] | void {
    // Clicking on the deck to draw a card is the most intuitive,
    // so we return the deck as the affected entity.
    return [runtime.anyEntity(UnoDeck)![entityId]];
  }
}
