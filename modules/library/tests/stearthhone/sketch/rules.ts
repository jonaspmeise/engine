/**
 * STEARTHHONE — RULES
 *
 * All ScopedRules and ScopedNegativeRules for the game, in one file.
 * Each rule declares `appliesIn` — the set of nodes where it is active.
 * The engine ignores this rule in all other nodes.
 *
 * A rule can appear in multiple nodes:
 *   appliesIn: ['MAIN_PHASE', 'SOME_OTHER_PHASE']
 *
 * RULES IN MAIN_PHASE:
 *   can-play-minion        (for each affordable minion card in hand)
 *   can-attack-with-minion (for each minion that can attack, for each valid target)
 *   can-attack-with-hero   (if hero has attack > 0)
 *   can-use-hero-power     (placeholder — hero powers are game-specific)
 *   can-end-turn           (always available)
 *
 * NEGATIVE RULES IN MAIN_PHASE:
 *   taunt-forces-attacks   (if enemy has taunt, you can only attack taunt minions / heroes behind taunt are protected)
 *   cant-attack            (Ragnaros: this specific minion is never allowed to attack)
 *   already-attacked       (minion has no attacks remaining)
 *   not-enough-mana        (card cost > current mana — belt-and-suspenders; positive rule pre-filters)
 */

import { Action } from '../../../src/components/action';
import { ActionChoice } from '../../../src/components/choice-action';
import { Choice } from '../../../src/components/choice';
import { QueryableRuntime } from '../../../src/interfaces/queryable-runtime';
import { ScopedFilterRule, ScopedGeneratorRule } from './engine-v2';
import { StoneGameState, StoneHero, StoneMinion } from './entities';
import { AttackAction, EndTurnAction, PlayMinionAction } from './actions';
import type { MinionCard } from '../stearthhone.typed';
import type { StoneNodes } from './graph';

// ---------------------------------------------------------------------------
// POSITIVE RULES
// ---------------------------------------------------------------------------

/** Play a minion card from hand. Generates one choice per affordable minion. */
const canPlayMinion: ScopedGeneratorRule<StoneNodes> = {
  name: 'can-play-minion',
  appliesIn: ['MAIN_PHASE'],
  apply(runtime: QueryableRuntime): Choice<Action<string, any>>[] | void {
    const phase = runtime.anyEntity(StoneGameState)!;
    const activePlayer = phase.activePlayer!;

    return activePlayer
      .hand(runtime)
      .filter(
        (c) =>
          c.base.type === 'minion' &&
          c.base.cost <= activePlayer.mana &&
          activePlayer.minions(runtime).length < 7, // max board size
      )
      .flatMap((card) => {
        // One choice per valid board position.
        const boardSize = activePlayer.minions(runtime).length;
        return Array.from(
          { length: boardSize + 1 },
          (_, pos) =>
            new ActionChoice(
              new PlayMinionAction({ card, boardPosition: pos }),
              activePlayer,
            ),
        );
      });
  },
};

/** Attack with a friendly minion. Generates one choice per valid (attacker, target) pair. */
const canAttackWithMinion: ScopedGeneratorRule<StoneNodes> = {
  name: 'can-attack-with-minion',
  appliesIn: ['MAIN_PHASE'],
  apply(runtime: QueryableRuntime): Choice<Action<string, any>>[] | void {
    const phase = runtime.anyEntity(StoneGameState)!;
    const activePlayer = phase.activePlayer!;
    const enemyHero = runtime
      .entities(StoneHero)
      .find((h) => h !== activePlayer)!;

    const attackers = activePlayer
      .minions(runtime)
      .filter(
        (m) =>
          m.canAttackThisTurn && m.attacksRemainingThisTurn > 0 && m.attack > 0,
      );

    if (attackers.length === 0) return;

    const enemyMinions = runtime
      .entities(StoneMinion)
      .filter((m) => m.owner !== activePlayer && !m.pendingDeath);

    // Collect valid targets. Negative rules (taunt) filter this further.
    const targets: (StoneMinion | StoneHero)[] = [...enemyMinions, enemyHero];

    return attackers.flatMap((attacker) =>
      targets.map(
        (defender) =>
          new ActionChoice(
            new AttackAction({ attacker, defender }),
            activePlayer,
          ),
      ),
    );
  },
};

/** Attack with the hero (requires a weapon or hero power that grants attack). */
const canAttackWithHero: ScopedGeneratorRule<StoneNodes> = {
  name: 'can-attack-with-hero',
  appliesIn: ['MAIN_PHASE'],
  apply(runtime: QueryableRuntime): Choice<Action<string, any>>[] | void {
    const phase = runtime.anyEntity(StoneGameState)!;
    const activePlayer = phase.activePlayer!;

    if (activePlayer.attack <= 0 || activePlayer.attacksRemainingThisTurn <= 0)
      return;

    const enemyHero = runtime
      .entities(StoneHero)
      .find((h) => h !== activePlayer)!;
    const enemyMinions = runtime
      .entities(StoneMinion)
      .filter((m) => m.owner !== activePlayer && !m.pendingDeath);

    const targets: (StoneMinion | StoneHero)[] = [...enemyMinions, enemyHero];

    return targets.map(
      (defender) =>
        new ActionChoice(
          new AttackAction({ attacker: activePlayer, defender }),
          activePlayer,
        ),
    );
  },
};

/** The active player can always end their turn. */
const canEndTurn: ScopedGeneratorRule<StoneNodes> = {
  name: 'can-end-turn',
  appliesIn: ['MAIN_PHASE'],
  apply(runtime: QueryableRuntime): Choice<Action<string, any>>[] | void {
    const phase = runtime.anyEntity(StoneGameState)!;
    const activePlayer = phase.activePlayer!;
    return [new ActionChoice(new EndTurnAction(), activePlayer)];
  },
};

export const STEARTHHONE_RULES: ScopedGeneratorRule<StoneNodes>[] = [
  canPlayMinion,
  canAttackWithMinion,
  canAttackWithHero,
  canEndTurn,
];

// ---------------------------------------------------------------------------
// NEGATIVE RULES
// ---------------------------------------------------------------------------

/**
 * Taunt: if the enemy has any taunt minions, attacks must target one of them.
 * Applies to both minion and hero attacks.
 *
 * Note: this is a global rule, not per-minion. It reads the board state at
 * evaluation time and blocks any attack that bypasses a taunt minion.
 */
const tauntForcesAttacks: ScopedFilterRule<StoneNodes> = {
  name: 'taunt-forces-attacks',
  appliesIn: ['MAIN_PHASE'],
  prevents(
    choice: Choice<Action<string, any>>,
    runtime: QueryableRuntime,
  ): boolean {
    if (!(choice.execution instanceof AttackAction)) return false;

    const { attacker, defender } = choice.execution.parameters;
    const phase = runtime.anyEntity(StoneGameState)!;
    const activePlayer = phase.activePlayer!;

    const enemyTaunts = runtime
      .entities(StoneMinion)
      .filter((m) => m.owner !== activePlayer && m.hasTaunt && !m.pendingDeath);

    if (enemyTaunts.length === 0) return false; // no taunts, allow everything

    // Prevent attacking anything that isn't a taunt minion.
    return !enemyTaunts.includes(defender as StoneMinion);
  },
};

/**
 * Specific minions that can't attack at all (e.g. Ragnaros).
 * This negative rule is registered per-minion at summon time when the card
 * has "Can't Attack" text — but for the sketch, we check the text directly.
 */
const cantAttackMinion: ScopedFilterRule<StoneNodes> = {
  name: 'cant-attack-minion',
  appliesIn: ['MAIN_PHASE'],
  prevents(choice: Choice<Action<string, any>>): boolean {
    if (!(choice.execution instanceof AttackAction)) return false;
    const { attacker } = choice.execution.parameters;
    if (!(attacker instanceof StoneMinion)) return false;
    return attacker.cantAttack;
  },
};

export const STEARTHHONE_NEGATIVE_RULES: ScopedFilterRule<StoneNodes>[] = [
  tauntForcesAttacks,
  cantAttackMinion,
];
