/**
 * ENGINE V2 — PROPOSED ARCHITECTURE
 *
 * Design pillars:
 *
 *   1. ONE node type. A node is always (runtime) => NodeId | void | Promise<...>.
 *      Returning a NodeId = transition immediately (no player input).
 *      Returning void   = "I'm done routing; present choices if any exist."
 *      If no choices exist when a node returns void → error (dead state).
 *
 *   2. ScopedGeneratorRules produce choices; ScopedFilterRules remove them.
 *      Both carry `appliesIn: NodeId[]` — strongly typed against the graph.
 *
 *   3. Game<GRAPH> is generic on its graph. Node IDs are inferred from the
 *      graph's keys, so `appliesIn: ['MAIM_PHASE']` is a compile-time error.
 *
 *   4. Trigger stack — for nested effects that need player input.
 *      Lifecycle hooks (onSummon, onDestroy, …) NEVER call runtime.prompt().
 *      Instead they push a TriggeredAction onto GameState.triggerStack.
 *      The engine drains the stack (LIFO — last-in-first-out, like MTG) after
 *      every action, before re-evaluating scoped rules. Each item on the stack
 *      is a plain Action (fully serialisable, fully cloneable → MCTS-safe).
 *
 *   5. Hidden information — per-entity class via a static `mask()` method.
 *      Each entity class decides what a given observer can see.
 *      The engine calls `EntityClass.mask(entity, observer)` when building
 *      the view for a player. Returns a shallow masked copy or the original.
 *
 * EXECUTION LOOP:
 *
 *   while (game is running):
 *     // 1. Drain the trigger stack first (effects from the last action).
 *     while (gameState.triggerStack.length > 0):
 *       action = gameState.triggerStack.pop()
 *       execute action (may push more items — resolved LIFO like a real stack)
 *
 *     // 2. Present choices (scoped to the current node).
 *     choices = generatorRules
 *       .filter(r => r.appliesIn.includes(currentNode))
 *       .flatMap(r => r.apply(runtime) ?? [])
 *       .filter(c => !filterRules.some(f => f.appliesIn.includes(currentNode) && f.prevents(c)))
 *
 *     if (choices.length > 0):
 *       present choices to the active player
 *       wait for choice → execute action → push triggered effects
 *       loop from top
 *     else:
 *       nextId = currentNode(runtime)
 *       if (nextId) → transition and loop
 *       else → halt (terminal node; game.end() must have been called)
 *
 * TRIGGER CHAIN EXAMPLE — "Play Battlecry that prompts for a target":
 *
 *   1. Player picks PlayMinionAction (pirate with "deal 2 damage: choose target").
 *   2. PlayMinionAction.doApply() places minion, calls card.onSummon(runtime, self).
 *   3. PirateCard.onSummon() pushes DealDamageToTargetAction onto triggerStack.
 *      It does NOT call runtime.prompt() — it just schedules the action.
 *   4. PlayMinionAction resolves.
 *   5. Engine drains stack: pops DealDamageToTargetAction.
 *   6. DealDamageToTargetAction.doApply() calls runtime.prompt(choices: validTargets).
 *      Player picks. Damage is applied.
 *   7. Stack is now empty. Engine re-evaluates scoped choices for MAIN_PHASE. Loop.
 *
 * MCTS SAFETY:
 *   triggerStack lives on the GameState entity.
 *   Each item is a concrete Action (a data object — no closures, no continuations).
 *   Clone captures the full stack → any mid-stack state is reproducible.
 *
 * HIDDEN INFORMATION:
 *   Each entity class declares `static mask(entity, observer): MaskedEntity`.
 *   The engine calls this when building a player's view of game state.
 *   Cards in the opponent's deck or hand return an opaque stub — only `location`
 *   is visible. A card in hand that is face-down (e.g. turned face-down by a spell)
 *   can override `mask()` to expose even less.
 */

import { Action } from '../../../src/components/action';
import { Choice } from '../../../src/components/choice';
import { Entity } from '../../../src/components/entity';
import { ModifiableRuntime } from '../../../src/interfaces/modifiable-runtime';
import { QueryableRuntime } from '../../../src/interfaces/queryable-runtime';
import { PlayerInterface } from '../../../src/interfaces/player-interface';

// ---------------------------------------------------------------------------
// Node — the only node type
// ---------------------------------------------------------------------------

export type NodeId = string;

/**
 * A node is a pure routing function.
 * Called only when no scoped rules generate choices for the current node.
 * Returns the ID of the next node to enter, or void for a terminal node.
 */
export type Node<NODES extends NodeId = NodeId> = (
  runtime: ModifiableRuntime,
) => NODES | void | Promise<NODES | void>;

export type Graph<NODES extends NodeId = NodeId> = {
  readonly [K in NODES]: Node<NODES>;
};

// ---------------------------------------------------------------------------
// ScopedGeneratorRule — generates player choices, scoped to specific nodes
// ---------------------------------------------------------------------------

/**
 * A rule that generates choices available to the active player.
 * The engine evaluates it only when `currentNode` is in `appliesIn`.
 * (renamed from ScopedRule → ScopedGeneratorRule for clarity)
 */
export interface ScopedGeneratorRule<NODES extends NodeId = NodeId> {
  readonly name: string;
  readonly appliesIn: ReadonlyArray<NODES>;
  apply(runtime: QueryableRuntime): Choice<Action<string, any>>[] | void;
}

// ---------------------------------------------------------------------------
// ScopedFilterRule — vetoes generated choices, scoped to specific nodes
// ---------------------------------------------------------------------------

/**
 * A rule that can remove generated choices before they are presented.
 * Returns true = "this choice is prevented."
 * (renamed from ScopedNegativeRule → ScopedFilterRule for clarity)
 */
export interface ScopedFilterRule<NODES extends NodeId = NodeId> {
  readonly name: string;
  readonly appliesIn: ReadonlyArray<NODES>;
  prevents(
    choice: Choice<Action<string, any>>,
    runtime: QueryableRuntime,
  ): boolean;
}

// ---------------------------------------------------------------------------
// Trigger — reacts to an executed action by $type
// ---------------------------------------------------------------------------

/**
 * After every action executes, the engine calls all triggers where
 *   trigger.on === action.$type (and optionally trigger.inNode === currentNode).
 *
 * Triggers MUST NOT call runtime.prompt(). Instead push a new action onto
 * runtime.pushTrigger() so that player input happens in a new stack frame.
 */
export interface Trigger<
  ACTION extends Action<string, any, any> = Action<string, any, any>,
> {
  readonly name: string;
  /** The $type of the action that activates this trigger. */
  readonly on: ACTION['$type'];
  /** Optional: only fire when the current graph node matches. */
  readonly inNode?: NodeId;
  apply(runtime: ModifiableRuntime, action: ACTION): void;
}

// ---------------------------------------------------------------------------
// Hook context objects
//
// Lifecycle hooks receive a typed context rather than raw arguments.
// The entity's method self-filters: e.g. a "whenever a friendly is summoned"
// effect checks `context.summoned !== self && context.summoned.owner === self.owner`.
// This removes the need for separate onAnyMinionSummoned / onFriendlyMinionDied
// reactive variants — every entity gets one call per event and decides relevance.
// ---------------------------------------------------------------------------

/** Context passed to onSummon. `summoned` is the minion that just entered. */
export interface SummonContext {
  readonly summoned: Entity; // concrete type is StoneMinion — left generic here
  readonly owner: Entity;    // the hero who controls it
}

/** Context passed to onDestroy / onMinionDied. */
export interface DestroyContext {
  readonly destroyed: Entity;
  readonly owner: Entity;
}

/** Context passed to onDamageTaken. */
export interface DamageContext {
  readonly target: Entity;
  readonly amount: number; // actual damage dealt (0 if absorbed by shield)
  readonly source: Entity | null;
}

// ---------------------------------------------------------------------------
// Hidden information — per-entity masking
// ---------------------------------------------------------------------------

/**
 * Visibility policy for a single entity from a particular observer's PoV.
 * FULL   = observer sees all fields.
 * HIDDEN = observer sees only the fields declared in the entity's `mask()`.
 * NONE   = observer doesn't know the entity exists (used for face-down cards
 *          in games where even the count is secret).
 */
export type Visibility = 'FULL' | 'HIDDEN' | 'NONE';

/**
 * A masked view of an entity.
 * Only properties explicitly included are visible; everything else is `unknown`.
 *
 * Pattern: each entity class overrides the static `mask()` factory to produce
 * an appropriate stub for hidden instances.
 *
 * Example — StoneCard.mask():
 *   static mask(card: StoneCard, observer: PlayerInterface): MaskedEntity<StoneCard> {
 *     // Opponent's deck or hand: only location is visible.
 *     if (card.location === 'deck' || card.owner !== observer) {
 *       return { [entityId]: card[entityId], $type: 'StoneCard', location: card.location };
 *     }
 *     return card; // own card: fully visible
 *   }
 */
export type MaskedEntity<E extends Entity = Entity> = Pick<E, typeof import('../../../src/components/entity').entityId> & Partial<E>;

/**
 * Masking interface that entity classes implement as a static method.
 * The engine calls this when serialising state for a specific client.
 *
 * For entities with no hidden state, the default (return `entity` unchanged)
 * is correct and no override is needed.
 */
export interface Maskable<E extends Entity = Entity> {
  /** Return value can be the original entity (FULL) or a sparse masked copy. */
  mask(entity: E, observer: PlayerInterface): MaskedEntity<E>;
}

// ---------------------------------------------------------------------------
// GameState — the entity that tracks current node + trigger stack
//
// Previously called GamePhase. Renamed to GameState to clarify:
//   - it has nothing to do with "phases" as a game-rule concept
//   - it is purely an infrastructure entity owned by the engine developer
//   - the dev extends it to carry any inter-node carry-state
//
// Because it is an Entity (part of the cloned snapshot), all fields are
// automatically MCTS-safe: cloning the game captures the full stack.
// ---------------------------------------------------------------------------

export abstract class GameState extends Entity {
  public currentNode: NodeId = 'SETUP';

  /**
   * LIFO trigger stack.
   * Lifecycle hooks push Actions here instead of calling runtime.prompt().
   * The engine drains this stack after every action, before re-presenting choices.
   * Each item may itself add more items — processed depth-first (stack = LIFO).
   */
  public triggerStack: Action<string, any, any>[] = [];

  public toString(): string {
    return `GameState(${this.currentNode})`;
  }
}

// ---------------------------------------------------------------------------
// Game<GRAPH> — generic on the graph so node IDs are strongly typed
// ---------------------------------------------------------------------------

export interface GameBase<
  GRAPH extends Graph<any>,
  PARAMETERS = undefined,
  NODES extends NodeId = keyof GRAPH & string,
> {
  graph(): GRAPH;
  generatorRules(): ScopedGeneratorRule<NODES>[];
  filterRules(): ScopedFilterRule<NODES>[] | void;
  triggers(): Trigger[];
}
