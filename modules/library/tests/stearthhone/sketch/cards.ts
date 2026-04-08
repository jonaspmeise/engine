import { ModifiableRuntime } from '../../../src/interfaces/modifiable-runtime';
import { StoneCard, StoneHero, StoneMinion, StoneGameState } from './entities';
import { DamageContext, DestroyContext, SummonContext } from './engine-v2';
import { allEnemyTargets, randomFrom } from './helpers';
import { DealDamageAction, SummonMinionAction } from './actions';
import type { Card, MinionCard } from '../stearthhone.typed';
import { StearthhoneCard } from './entities/StearthhoneCard';
import { StearthhoneMinion } from './entities/StearthhoneMinion';

export const cards: StearthhoneCard[] = [new StearthhoneMinion('1')];

export class GurubashiBerserker extends StoneCard {
  static readonly stats: MinionCard = {
    name: 'Gurubashi Berserker',
    cost: 5,
    type: 'minion',
    rarity: 'epic',
    attack: 2,
    health: 7,
    text: 'Whenever this minion takes damage, gain +3 Attack.',
  };

  constructor(id: string, owner: StoneHero) {
    super(id, owner, GurubashiBerserker.stats);
  }

  override onDamageTaken(
    _runtime: ModifiableRuntime,
    self: StoneMinion,
    context: DamageContext,
  ): void {
    // Guard: only react when this specific minion took damage.
    if (context.target !== self) return;
    if (context.amount > 0) self.attack += 3;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Damaged Golem — 2/1 token produced by Harvest Golem's deathrattle.
// No lifecycle effects of its own.
// ─────────────────────────────────────────────────────────────────────────────

export class DamagedGolem extends StoneCard {
  static readonly stats: MinionCard = {
    name: 'Damaged Golem',
    cost: 0,
    type: 'minion',
    rarity: 'common',
    attack: 2,
    health: 1,
    text: undefined,
  };

  constructor(id: string, owner: StoneHero) {
    super(id, owner, DamagedGolem.stats);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Harvest Golem (3 mana, 2/3 — Common)
// "Deathrattle: Summon a 2/1 Damaged Golem."
// ─────────────────────────────────────────────────────────────────────────────

export class HarvestGolem extends StoneCard {
  static readonly stats: MinionCard = {
    name: 'Harvest Golem',
    cost: 3,
    type: 'minion',
    rarity: 'common',
    attack: 2,
    health: 3,
    text: 'Deathrattle: Summon a 2/1 Damaged Golem.',
  };

  constructor(id: string, owner: StoneHero) {
    super(id, owner, HarvestGolem.stats);
  }

  override onDestroy(
    runtime: ModifiableRuntime,
    self: StoneMinion,
    context: DestroyContext,
  ): void {
    // Guard: only the golem itself fires its deathrattle.
    if (context.destroyed !== self) return;
    // Push SummonMinionAction onto triggerStack — deferred and MCTS-safe.
    runtime.anyEntity(StoneGameState)!.triggerStack.push(
      new SummonMinionAction({
        CardClass: DamagedGolem,
        owner: self.owner,
        boardPosition: self.boardPosition,
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fire Imp (1 mana, 3/2 — Common • Warlock)
// "Battlecry: Deal 1 damage to your hero."
// ─────────────────────────────────────────────────────────────────────────────

export class FireImp extends StoneCard {
  static readonly stats: MinionCard = {
    name: 'Fire Imp',
    cost: 1,
    type: 'minion',
    rarity: 'common',
    attack: 3,
    health: 2,
    text: 'Battlecry: Deal 1 damage to your hero.',
  };

  constructor(id: string, owner: StoneHero) {
    super(id, owner, FireImp.stats);
  }

  /** Battlecry: deal 1 to own hero on summon. */
  override onSummon(
    runtime: ModifiableRuntime,
    self: StoneMinion,
    context: SummonContext,
  ): void {
    // Guard: only fire the battlecry for this imp's own summon event.
    if (context.summoned !== self) return;
    // Push through DealDamageAction so any 'deal_damage' trigger fires correctly.
    runtime
      .anyEntity(StoneGameState)!
      .triggerStack.push(
        new DealDamageAction({ source: self, target: self.owner, amount: 1 }),
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ragnaros the Firelord (8 mana, 8/8 — Legendary)
// "Can't Attack. At the end of your turn, deal 8 damage to a random enemy."
// ─────────────────────────────────────────────────────────────────────────────

export class RagnarosTheFirelord extends StoneCard {
  static readonly stats: MinionCard = {
    name: 'Ragnaros the Firelord',
    cost: 8,
    type: 'minion',
    rarity: 'legendary',
    attack: 8,
    health: 8,
    text: "Can't Attack. At the end of your turn, deal 8 damage to a random enemy.",
  };

  /** Blocks PlayMinionAction from granting attack tokens to this minion. */
  override readonly cantAttack: boolean = true;

  constructor(id: string, owner: StoneHero) {
    super(id, owner, RagnarosTheFirelord.stats);
  }

  /** End-of-turn: deal 8 damage to a random enemy target (minion or hero). */
  override onEndOfTurn(runtime: ModifiableRuntime, self: StoneMinion): void {
    const target = randomFrom(allEnemyTargets(runtime, self.owner));
    if (!target) return;
    // Push through DealDamageAction so triggers listening for 'deal_damage' fire.
    runtime
      .anyEntity(StoneGameState)!
      .triggerStack.push(
        new DealDamageAction({ source: self, target, amount: 8 }),
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Card registry & factory
//
// Maps card name → constructor to allow deck-building by name.
// Cards with no effects need no entry here — they fall back to base StoneCard.
// ─────────────────────────────────────────────────────────────────────────────

type CardCtor = new (id: string, owner: StoneHero) => StoneCard;

const REGISTRY = new Map<string, CardCtor>([
  [GurubashiBerserker.stats.name, GurubashiBerserker],
  [HarvestGolem.stats.name, HarvestGolem],
  [FireImp.stats.name, FireImp],
  [RagnarosTheFirelord.stats.name, RagnarosTheFirelord],
]);

/**
 * Instantiate the right card class for a given card definition.
 * If the card has registered effects, returns the specific subclass.
 * Otherwise returns a generic `StoneCard` (data only, all hooks are no-ops).
 */
export function createCard(
  id: string,
  owner: StoneHero,
  base: Readonly<Card>,
): StoneCard {
  const Ctor = REGISTRY.get(base.name);
  if (Ctor) return new Ctor(id, owner);
  return new StoneCard(id, owner, base);
}
