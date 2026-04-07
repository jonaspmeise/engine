/**
 * STEARTHHONE — GRAPH
 *
 * Only routing logic lives here.
 * No choice construction. No rules. No action building.
 *
 * The graph answers one question per node:
 *   "Given the current state, which node comes next?"
 *
 * If no node is returned (void), the engine presents the scoped choices
 * for this node (from rules.ts) and loops.
 *
 * TURN STRUCTURE:
 *
 *   TURN_START
 *     ↓ (always)
 *   MAIN_PHASE          ← player acts here (choices scoped from rules.ts)
 *     ↓ (once EndTurnAction is chosen)
 *   END_OF_TURN         ← end-of-turn triggers fire
 *     ↓ (always)
 *   CHECK_WIN
 *     ↓ someone won     ↓ nobody won
 *   GAME_OVER        SWITCH_PLAYER
 *                       ↓
 *                    TURN_START  (loops)
 */

import { DrawCardAction } from './actions';
import { StoneGameState, StoneHero } from './entities';
import { Graph, NodeId } from './engine-v2';
import { ModifiableRuntime } from '../../../src/interfaces/modifiable-runtime';

// Derive node IDs as a union so rules.ts gets compile-time checking.
export type StoneNodes =
  | 'TURN_START'
  | 'MAIN_PHASE'
  | 'END_OF_TURN'
  | 'CHECK_WIN'
  | 'SWITCH_PLAYER'
  | 'GAME_OVER';

export const StoneGraph = {
  // ── TURN_START ──────────────────────────────────────────────────────────
  // Draw a card, increment and refill mana. Pure routing — never waits for
  // player input, so always returns a NodeId.

  TURN_START: async (runtime: ModifiableRuntime): Promise<StoneNodes> => {
    const phase = runtime.anyEntity(StoneGameState)!; (capped at 10).
    activePlayer.maxMana = Math.min(activePlayer.maxMana + 1, 10);
    activePlayer.mana = activePlayer.maxMana;

    // Reset minion attacks.
    activePlayer.minions(runtime).forEach((m) => {
      m.canAttackThisTurn = m.attack > 0;
      m.attacksRemainingThisTurn = m.hasWindfury ? 2 : 1;
    });

    // Draw a card (no choice — deterministic).
    await new DrawCardAction({ player: activePlayer }).apply(runtime);

    return 'MAIN_PHASE';
  },

  // ── MAIN_PHASE ──────────────────────────────────────────────────────────
  // Returns void — hands control to the choice system.
  // All choices are declared in rules.ts scoped to 'MAIN_PHASE'.
  // This node is only called by the engine when there are NO choices left,
  // which should never happen in a real game (can-end-turn always generates one).
  // If ever called: something is wrong — return to MAIN_PHASE to surface the error.

  MAIN_PHASE: (_runtime: ModifiableRuntime): void => {
    // Intentionally returns void.
    // The engine presents choices (from rules.ts) before ever calling this.
  },

  // ── END_OF_TURN ─────────────────────────────────────────────────────────
  // End-of-turn triggers fire here (e.g. Ragnaros, any "at end of turn" effect).
  // After EndTurnAction resolves, the engine calls all triggers with on: 'end_turn'.
  // No player input → always returns next node.

  END_OF_TURN: async (runtime: ModifiableRuntime): Promise<StoneNodes> => {
    // Any deterministic end-of-turn cleanup can go here.
    // Card-specific end-of-turn effects are triggers (on: 'end_turn') registered when summoned.
    return 'CHECK_WIN';
  },

  // ── CHECK_WIN ────────────────────────────────────────────────────────────

  CHECK_WIN: (runtime: ModifiableRuntime): StoneNodes => {
    const heroes = runtime.entities(StoneHero);
    const dead = heroes.filter((h) => !h.isAlive());

    if (dead.length === 0) return 'SWITCH_PLAYER';

    const alive = heroes.filter((h) => h.isAlive());
    runtime.end({
      winners: alive,
      losers: dead,
      draws: dead.length === heroes.length ? dead : [],
    });

    return 'GAME_OVER';
  },

  // ── SWITCH_PLAYER ────────────────────────────────────────────────────────

  SWITCH_PLAYER: (runtime: ModifiableRuntime): StoneNodes => {
    const phase = runtime.anyEntity(StoneGameState)!;!;
    phase.activePlayer = heroes.find((h) => h !== current) ?? current;
    return 'TURN_START';
  },

  // ── GAME_OVER ────────────────────────────────────────────────────────────

  GAME_OVER: (_runtime: ModifiableRuntime): void => {
    // Terminal node. game.end() was called in CHECK_WIN.
  },
} satisfies Graph<StoneNodes>;
