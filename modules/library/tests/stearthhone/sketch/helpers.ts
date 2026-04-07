/**
 * STEARTHHONE — HELPERS
 *
 * Pure query and mutation helpers for writing card effects.
 * All helpers take `runtime` as their first argument so they can be used
 * directly inside lifecycle hooks (onSummon, onDestroy, onEndOfTurn, …).
 *
 * Usage example inside a card class:
 *
 *   override onEndOfTurn(runtime, self) {
 *     const target = randomFrom(allEnemyTargets(runtime, self.owner));
 *     if (target) dealDamage(target, 8);
 *   }
 */

import { ModifiableRuntime } from '../../../src/interfaces/modifiable-runtime';
import { StoneGameState, StoneHero, StoneMinion } from './entities';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The hero whose turn it currently is. */
export function activePlayer(runtime: ModifiableRuntime): StoneHero {
  return runtime.anyEntity(StoneGameState)!.activePlayer!;
}

/** The opponent of `owner`. */
export function enemyHero(
  runtime: ModifiableRuntime,
  owner: StoneHero,
): StoneHero {
  return runtime.entities(StoneHero).find((h) => h !== owner)!;
}

/** All live minions controlled by `owner`. */
export function friendlyMinions(
  runtime: ModifiableRuntime,
  owner: StoneHero,
): StoneMinion[] {
  return owner.minions(runtime).filter((m) => !m.pendingDeath);
}

/** All live enemy minions (not owned by `owner`). */
export function enemyMinions(
  runtime: ModifiableRuntime,
  owner: StoneHero,
): StoneMinion[] {
  return runtime
    .entities(StoneMinion)
    .filter((m) => m.owner !== owner && !m.pendingDeath);
}

/**
 * All valid targets on the enemy side: their live minions + their hero.
 * Respects Taunt — if any enemy minion has Taunt, only taunt minions are returned.
 */
export function allEnemyTargets(
  runtime: ModifiableRuntime,
  owner: StoneHero,
): (StoneMinion | StoneHero)[] {
  const minions = enemyMinions(runtime, owner);
  const taunts = minions.filter((m) => m.hasTaunt);
  if (taunts.length > 0) return taunts;
  return [...minions, enemyHero(runtime, owner)];
}

/** Pick a random element from an array. Returns `undefined` if the array is empty. */
export function randomFrom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------

/**
 * Deal `amount` damage to a target (minion or hero).
 * - Minion with Divine Shield: absorbs damage, returns 0.
 * - Hero: armor absorbs first, then health.
 * Returns the actual damage dealt (0 when shield absorbs).
 * This is a pure entity-mutation helper. Event dispatch happens in DealDamageAction.
 */
export function dealDamage(
  target: StoneMinion | StoneHero,
  amount: number,
): number {
  if (amount <= 0) return 0;
  if (target instanceof StoneMinion) {
    if (target.hasDivineShield) {
      target.hasDivineShield = false;
      return 0;
    }
    target.health -= amount;
    return amount;
  }
  // Hero: armor soaks first.
  const absorbed = Math.min(target.armor, amount);
  target.armor -= absorbed;
  target.health -= amount - absorbed;
  return amount;
}
H
