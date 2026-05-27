import { QueryableRuntime } from '../../../src';
import { UnoCard } from './card';
import { UnoZone } from './zone';

export class UnoDiscardPile extends UnoZone {
  public static readonly $type: string = 'DiscardPile';
  public toString(): string {
    return 'Discard Pile';
  }

  public $type: string = 'DiscardPile';

  constructor() {
    super('discard-pile');
  }

  // A top card always has to exist!
  public top(runtime: QueryableRuntime): UnoCard {
    const cards = this.cards(runtime);
    return cards[cards.length - 1]!;
  }
}
