/**
 * STEARTHHONE — GAME CLASS
 *
 * The Game subclass wires together the graph, rules, triggers, and entities.
 * It is intentionally thin. All logic lives in the other files.
 *
 * Notice: Game<typeof StoneGraph> — the generic captures the graph keys,
 * so any `appliesIn: ['MAIM_PHASE']` typo in rules.ts would be a compile error.
 */

import { Entity } from '../../../src/components/entity';
import { Game } from '../../../src/game';
import { TriggerReturnType } from '../../../src/components/trigger';
import { StoneGraph } from './graph';
import { STEARTHHONE_RULES, STEARTHHONE_NEGATIVE_RULES } from './rules';
import { createCard } from './cards';
import type { Card } from '../stearthhone.typed';
import {
  FilterRule,
  GeneratorRule,
  QueryableRuntime,
  ViewFilter,
} from '../../../src';

// ---------------------------------------------------------------------------
// Game class
// ---------------------------------------------------------------------------

export class Stearthhone extends Game {
  viewFilters(runtime: QueryableRuntime): Set<ViewFilter> | void {
    throw new Error('Method not implemented.');
  }
  public name = 'Stearthhone';

  // ── In engine-v2, this becomes: extends Game<typeof StoneGraph, StoneParameters>
  // ── For now, these methods mirror the proposed GameBase<GRAPH> interface.

  graph() {
    return StoneGraph;
  }

  generatorRules() {
    return STEARTHHONE_RULES;
  }

  filterRules() {
    return STEARTHHONE_NEGATIVE_RULES;
  }

  triggers() {
    // Card effects are handled via lifecycle hooks on card classes (cards.ts).
    // System-level triggers (e.g. global auras) can be added here.
    return [];
  }

  setupActions(): TriggerReturnType[] | void {
    // No setup actions — the SETUP node in the graph handles initial draw.
    // (Or TURN_START handles it, since SETUP is not in this graph.)
  }

  // Hidden information is handled by per-entity static mask() methods.
  // StoneCard.mask() returns an opaque stub for cards in the opponent's hand/deck.

  protected entityClasses() {
    return new Set([StoneHero, StoneCard, StoneMinion, StoneGameState]);
  }

  protected initialize(parameters: StoneParameters): Set<Entity> {
    const entities = new Set<Entity>();
    const cardDb: Card[] = require('../cards.json') as Card[];

    const hero1 = new StoneHero('hero-1', 'Player 1');
    const hero2 = new StoneHero('hero-2', 'Player 2');
    entities.add(hero1);
    entities.add(hero2);

    // Build decks from card names.
    for (const [heroIndex, [hero, deckList]] of (
      [
        [hero1, parameters.player1Deck],
        [hero2, parameters.player2Deck],
      ] as [StoneHero, string[]][]
    ).entries()) {
      deckList.forEach((cardName, i) => {
        const base = cardDb.find((c) => c.name === cardName);
        if (!base) throw new Error(`Unknown card: ${cardName}`);
        const card = createCard(`card-${heroIndex}-${i}`, hero, base);
        card.location = 'deck';
        entities.add(card);
      });
    }

    // Game phase: track current node and active player.
    const phase = new StoneGameState();
    phase.activePlayer = hero1;
    phase.currentNode = 'TURN_START';
    entities.add(phase);

    return entities;
  }
}
