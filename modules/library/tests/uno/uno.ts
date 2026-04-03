import {
  Entity,
  PositiveRule,
  NegativeRule,
  Trigger,
  ViewFilter,
  EntityClass,
} from '../../src';
import { Game } from '../../src/game';
import { UnoCard } from './card';
import { Deck } from './deck';
import { DefaultCard } from './default-card';
import { DiscardPile } from './discard-pile';
import { UnoHand } from './hand';
import { UnoPlayer } from './player';

export const UnoDefaultColors = ['red', 'yellow', 'green', 'blue'] as const;

export class Uno extends Game<{
  playerSize: number;
}> {
  protected initialize(parameters: { playerSize: number }): Set<Entity> {
    const entities: Set<Entity> = new Set();

    // Spawn discard pile.
    entities.add(new DiscardPile());

    // Spawn deck.
    const deck = new Deck();
    entities.add(deck);

    for (let i = 1; i <= parameters.playerSize; i++) {
      // Spawn players.
      const player = new UnoPlayer(`player${i}`);
      entities.add(player);

      // Spawn hands.
      entities.add(new UnoHand(player));
    }

    // Spawn cards.
    // Default cards.
    for (const [i, color] of UnoDefaultColors.entries()) {
      for (let value = 0; value <= 9; value++) {
        entities.add(new DefaultCard(color, value, deck, 10 * i + value));
      }
    }

    return entities;
  }
  public name: string = 'Uno';

  positiveRules(): Set<PositiveRule> {
    return new Set([{
      name: 'current-player-can-play-card',
      apply: (runtime) => {
        const currentPlayer = runtime.players()[0]; // For testing purposes, we just take the first player as the current player.
    }])
  }

  negativeRules(): Set<NegativeRule> | void {
    throw new Error('Method not implemented.');
  }
  triggers(): Set<Trigger> | void {
    throw new Error('Method not implemented.');
  }
  viewFilters(): Set<ViewFilter> | void {
    throw new Error('Method not implemented.');
  }
  protected entityClasses(): Set<EntityClass<Entity>> {
    throw new Error('Method not implemented.');
  }
}
