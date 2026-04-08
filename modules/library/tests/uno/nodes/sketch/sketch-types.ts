/**
 * SKETCH — proposed engine extensions for typed events + phase-scoped nodes.
 *
 * Touches:
 *   - Action: add abstract emits() — replaces card.onPlay() / entity logic
 *   - Trigger: narrow to typed events instead of lastChoice: Choice<any>
 *   - Graph/Node: promote to RichNode with scoped choices + onChoice transition
 *   - New: GameEvent base, GamePhase entity (inter-node carry state)
 *   - New: RichGraph replaces Graph
 *
 * Nothing here is final — it is a design surface to argue against.
 */

import { Action } from '../../../../src/components/action';
import { Choice } from '../../../../src/components/choice';
import { Entity } from '../../../../src/components/entity';
import { NegativeRule } from '../../../../src/components/rules/filter-rule';
import { PositiveRule } from '../../../../src/components/rules/generator-rule';
import { ModifiableRuntime } from '../../../../src/interfaces/modifiable-runtime';
import { NodeId } from '../../../../src/components/graph/node.types';

// ---------------------------------------------------------------------------
// 1. Typed Game Events
//
// Actions emit typed events instead of side-effecting arbitrary entity logic
// (e.g. card.onPlay()). Triggers subscribe to specific event types.
// This makes card effects declarative: the card entity stays pure data.
// ---------------------------------------------------------------------------

export interface GameEvent {
  readonly type: string;
}

// Engine change: Action gains an `emits()` method (optional default = []).
// We extend the abstract class signature — game-specific event types are
// declared by the concrete game, Actions are typed against them.
//
// Current Action signature:
//   Action<ACTION_TYPE, PARAMETERS, RETURN_TYPE>
//
// Proposed addition (no breaking change — default implementation returns []):
//
//   public emits(result: RETURN_TYPE): EVENT[] { return []; }
//
// The engine calls action.emits(result) after doApply() resolves and
// dispatches those events to the trigger system before the next snapshot.

// ---------------------------------------------------------------------------
// 2. Typed Trigger (replaces current Trigger interface)
//
// Instead of: apply(state, lastChoice: Choice<any> | undefined)
// Now:        on[] declares which event types activate this trigger.
//             apply receives the concrete, narrowed event.
//
// The engine only calls apply() for matching event types, so triggers
// never have to "if (event.type !== X) return" at the top.
// ---------------------------------------------------------------------------

export interface TypedTrigger<EVENT extends GameEvent = GameEvent> {
  readonly name: string;
  readonly on: ReadonlyArray<EVENT['type']>;
  apply(runtime: ModifiableRuntime, event: EVENT): void;
}

// ---------------------------------------------------------------------------
// 3. RichNode — node with phase-scoped rules
//
// Replaces:  Node = (runtime) => Promise<NodeId> | NodeId | void
//
// A RichNode can be:
//   a) A routing node (enter only, returns NodeId immediately, no choices)
//   b) A choice node  (choices + onChoice, suspends until a choice is made)
//
// Routing nodes never block. Choice nodes block until a player decides.
// The engine tracks the "current node" in a GamePhase entity so that
// cloning is always safe — the clone resumes from the same node.
// ---------------------------------------------------------------------------

export type RichNode = RoutingNode | ChoiceNode;

/** Runs enter(), gets a NodeId back, never blocks. Used for logic/branching. */
export interface RoutingNode {
  readonly kind: 'routing';
  enter(runtime: ModifiableRuntime): NodeId | void | Promise<NodeId | void>;
}

/**
 * Declares a choice space (scoped rules) and a transition handler.
 * The engine calls onChoice() after the player picks, then transitions.
 *
 * Because the current node is stored in GamePhase (an entity), MCTS
 * can clone the game at any moment and knows exactly which node to
 * re-enter, with which choices — no suspended coroutine needed.
 */
export interface ChoiceNode {
  readonly kind: 'choice';
  choices: ReadonlyArray<PositiveRule>;
  negativeRules?: ReadonlyArray<NegativeRule>;
  onChoice(
    runtime: ModifiableRuntime,
    choice: Choice<Action<string, any>>,
  ): NodeId | void | Promise<NodeId | void>;
}

export type RichGraph = Record<NodeId, RichNode>;

// ---------------------------------------------------------------------------
// 4. GamePhase — the inter-node carry entity
//
// Replaces: suspended coroutine state (e.g. "the card drawn this turn")
// Anything that used to live between two `await prompt()` calls now lives here.
// Because it is an Entity, it is part of the cloned game state automatically.
// ---------------------------------------------------------------------------

export abstract class GamePhase extends Entity {
  public $type = 'GamePhase';
  public currentNode: NodeId = 'SETUP';

  constructor() {
    super('game-phase');
  }

  public toString(): string {
    return `GamePhase(${this.currentNode})`;
  }
}
