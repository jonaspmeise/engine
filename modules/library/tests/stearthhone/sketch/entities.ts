/**
 * STEARTHHONE — ENTITIES
 *
 * Pure data. No logic, no effects. Effects live in card subclasses (cards.ts).
 *
 * Key structural decision: cards and minions are separate entities.
 *   - StoneCard  = the card in a hand or deck (data + location)
 *   - StoneMinion = the card when on the board (gets its own entity with
 *                   mutable combat stats separate from the card's base values)
 *
 * HIDDEN INFORMATION:
 *   Each entity class may declare a static `mask(entity, observer)` method.
 *   The engine calls this when serialising state for a specific client.
 *   Cards in the opponent's deck or hand show only location by default.
 *   Override `mask()` in subclasses for stricter or looser policies.
 */

import { Entity, entityId } from '../../../src/components/entity';
import {
  handler,
  playerId,
  PlayerInterface,
  PlayerInterfaceCallback,
  playerInterfaceMarker,
} from '../../../src/interfaces/player-interface';
import { ModifiableRuntime } from '../../../src/interfaces/modifiable-runtime';
import { QueryableRuntime } from '../../../src/interfaces/queryable-runtime';
import {
  DamageContext,
  DestroyContext,
  GameState,
  MaskedEntity,
  SummonContext,
} from './engine-v2';
import type { MinionCard, Card } from '../stearthhone.typed';

// ---------------------------------------------------------------------------
// StoneHero — player entity, also the PlayerInterface
// ---------------------------------------------------------------------------

export class StoneHero extends Entity implements PlayerInterface {
  public $type = 'StoneHero';

  [playerInterfaceMarker]: true = true as const;
  [handler]?: PlayerInterfaceCallback;
  [playerId]?: string;

  public health: number = 30;
  public maxHealth: number = 30;
  public armor: number = 0;

  /** Attack from equipped weapon or hero power (reset each turn). */
  public attack: number = 0;
  public attacksRemainingThisTurn: number = 0;

  public mana: number = 0;
  public maxMana: number = 0; // starts 0, grows by 1 each turn, caps at 10
  public heroPowerUsedThisTurn: boolean = false;

  constructor(
    id: string,
    public readonly name: string,
  ) {
    super(id);
  }

  public isAlive(): boolean {
    return this.effectiveHealth() > 0;
  }

  public effectiveHealth(): number {
    return this.health + this.armor;
  }

  // Convenience: all minions this hero owns that are on the board.
  public minions(runtime: QueryableRuntime): StoneMinion[] {
    return runtime
      .entities(StoneMinion)
      .filter((m) => m.owner[entityId] === this[entityId]);
  }

  // Convenience: all cards in this player's hand.
  public hand(runtime: QueryableRuntime): StoneCard[] {
    return runtime
      .entities(StoneCard)
      .filter(
        (c) => c.location === 'hand' && c.owner[entityId] === this[entityId],
      )
      .sort((a, b) => a.handPosition - b.handPosition);
  }

  // Convenience: cards in deck.
  public deck(runtime: QueryableRuntime): StoneCard[] {
    return runtime
      .entities(StoneCard)
      .filter(
        (c) => c.location === 'deck' && c.owner[entityId] === this[entityId],
      );
  }

  public toString(): string {
    return `${this.name} (${this.health}hp)`;
  }
}

// ---------------------------------------------------------------------------
// StoneCard — a card in hand, deck, or graveyard
// ---------------------------------------------------------------------------

export class StoneCard extends Entity {
  public $type = 'StoneCard';

  public location: 'deck' | 'hand' | 'graveyard' | 'played' = 'deck';
  public handPosition: number = 0;

  constructor(
    id: string,
    public readonly owner: StoneHero,
    /** The original definition (from cards.json or equivalent). Immutable. */
    public readonly base: Readonly<Card>,
  ) {
    super(id);
  }

  public toString(): string {
    return `${this.base.name} [${this.base.cost} mana]`;
  }

  // ── Hidden information ────────────────────────────────────────────────────
  // When a card is in the opponent's deck or hand the observer only knows it
  // exists (via its location) and nothing else. The engine calls this static
  // method when building each player's view of game state.
  //
  // Subclasses may override to show more (e.g. a revealed card) or less
  // (e.g. a face-down card in hand that even the owner shouldn't see yet).

  static mask(
    card: StoneCard,
    observer: PlayerInterface,
  ): MaskedEntity<StoneCard> {
    // Own cards: always fully visible.
    if ((card.owner as unknown as PlayerInterface) === observer) return card;
    // Played or graveyard cards: visible to all (the board is public).
    if (card.location === 'played' || card.location === 'graveyard')
      return card;
    // Opponent's deck or hand: show only location (count is also public info).
    return {
      [entityId]: card[entityId],
      $type: 'StoneCard',
      location: card.location,
    } as MaskedEntity<StoneCard>;
  }

  // ── Keyword declarations ───────────────────────────────────────────────────
  // Copied to the StoneMinion on summon. Override as `true` in subclasses.
  readonly hasTaunt: boolean = false;
  readonly hasDivineShield: boolean = false;
  readonly hasWindfury: boolean = false;
  readonly hasCharge: boolean = false;
  /** The minion can never declare an attack (e.g. Ragnaros). */
  readonly cantAttack: boolean = false;

  // ── Lifecycle hooks ────────────────────────────────────────────────────────
  // All hooks receive a typed context object. The entity is responsible for
  // checking whether the event is relevant to itself.
  //
  // ENGINE CONTRACT:
  //   - onSummon    is called for the newly summoned minion AND for every other
  //                 live minion on the board (passing the same context).
  //                 Cards that react to OTHER summons check context.summoned !== self.
  //   - onDestroy   is called for the dying minion AND for every other live
  //                 minion (they can react to deaths of allies/enemies).
  //   - onDamageTaken is called only for the entity that took the damage.
  //   - onEndOfTurn / onStartOfTurn: called for every live board minion.
  //   - onDraw: called on the card entity itself when drawn from deck.
  //
  // PROMPTS IN HOOKS:
  //   Hooks MUST NOT call runtime.prompt() directly.
  //   If a card needs player input (e.g. "choose a target"), push a deferred
  //   Action onto the trigger stack instead:
  //     runtime.pushTrigger(new ChooseTargetAction({ card: this, ... }));
  //   The engine processes the stack before re-evaluating choices, in LIFO order.

  /**
   * Called when any minion enters the board.
   * `context.summoned` is the incoming minion.
   * Check `context.summoned === self` to guard your own battlecry;
   * check `context.summoned.owner === self.owner && context.summoned !== self`
   * for "whenever a FRIENDLY minion is summoned" effects.
   */
  onSummon(
    _runtime: ModifiableRuntime,
    _self: StoneMinion,
    _context: SummonContext,
  ): void {}

  /**
   * Called when any minion is destroyed.
   * `context.destroyed` is the dying minion.
   * Check `context.destroyed === self` for deathrattle;
   * check `context.destroyed.owner === self.owner` for "friendly died" effects.
   */
  onDestroy(
    _runtime: ModifiableRuntime,
    _self: StoneMinion,
    _context: DestroyContext,
  ): void {}

  /** Called on the damaged entity only. Guards against divine shield (amount is 0 then). */
  onDamageTaken(
    _runtime: ModifiableRuntime,
    _self: StoneMinion,
    _context: DamageContext,
  ): void {}

  /** Called for every live friendly minion at end of owner's turn. */
  onEndOfTurn(_runtime: ModifiableRuntime, _self: StoneMinion): void {}

  /** Called for every live friendly minion at start of owner's turn. */
  onStartOfTurn(_runtime: ModifiableRuntime, _self: StoneMinion): void {}

  /** Called on the card entity when it is drawn from the deck. */
  onDraw(_runtime: ModifiableRuntime): void {}
}

// ---------------------------------------------------------------------------
// StoneMinion — a minion on the board
//
// Created from a StoneCard when a minion card is played.
// Has its own mutable combat stats (buffed independently from base card).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// StoneGameState — inter-node carry state
//
// Extends GameState (an Entity) so it participates in cloning.
// Track current node, active player, and the trigger stack here.
// This is the only place you need to extend GameState — everything else is
// handled by the base class.
// ---------------------------------------------------------------------------

export class StoneGameState extends GameState {
  public $type = 'StoneGameState';
  public currentNode: string = 'TURN_START';

  /** Which player is currently taking their turn. */
  public activePlayer: StoneHero | null = null;

  constructor() {
    super('game-state');
  }
}
