import { Entity } from '../../entity';
import { Game } from '../../game';
import type { GameParameters, GameState } from '../../game.types';

type Card = { readonly color: string; readonly value: number };

type UnoState = GameState & {
  readonly deck: ReadonlyArray<Card>;
  readonly hand: ReadonlyArray<Card>;
};

type UnoParameters = GameParameters & {
  readonly startingHandSize: number;
};

class CardEntity extends Entity<UnoState> {
  constructor(public readonly card: Card) {
    super('card');
  }

  identify(): string {
    return `${this.card.color}-${this.card.value}`;
  }

  persist(_state: UnoState): void {}
}

export class Uno extends Game<UnoState, UnoParameters> {
  initialize(parameters: UnoParameters): UnoState {
    const deck: Card[] = Array.from({ length: parameters.startingHandSize }, (_, i) => ({
      color: 'red',
      value: i,
    }));

    return { deck, hand: [] };
  }

  enrichen(state: UnoState): ReadonlyArray<Entity<UnoState>> {
    return state.deck.map((card) => new CardEntity(card));
  }
}
