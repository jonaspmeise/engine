import {
  Action,
  Entity,
  entityId,
  ModifiableRuntime,
  PlayerEntity,
  QueryableRuntime,
} from '../../../src';
import { UnoDeck } from '../entities/deck';
import { UnoCard } from '../entities/card';
import { UnoZone } from '../entities/zone';

export class UnoShuffleAction extends Action<
  'shuffle',
  { from: UnoZone; to: UnoDeck }
> {
  async doApply(runtime: ModifiableRuntime): Promise<void> {
    this.parameters.from.cards(runtime).forEach((card) => {
      card.location = this.parameters.to;
    });

    const deckId = this.parameters.to[entityId];
    const cards = runtime
      .entities(UnoCard)
      .filter((c) => c.location?.[entityId] === deckId) as UnoCard[];

    // Fisher-Yates shuffle: reassign positions randomly
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cards[i]!.position;
      cards[i]!.position = cards[j]!.position;
      cards[j]!.position = tmp;
    }
  }

  public message(_player: PlayerEntity): string {
    return `The deck is shuffled.`;
  }

  public prompt(): string {
    return `Shuffle the deck.`;
  }

  public affectedEntities(_runtime: QueryableRuntime): Entity[] | void {
    return [this.parameters.to];
  }

  public $type: 'shuffle' = 'shuffle';
}
