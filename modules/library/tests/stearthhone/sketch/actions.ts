/**
 * STEARTHHONE — ACTIONS
 *
 * Actions are the only way game state changes.
 * Triggers subscribe to an action's $type string — no separate event objects.
 *
 * Shown here: PlayMinionAction, AttackAction, EndTurnAction, DrawCardAction.
 * SpellActions follow the same pattern.
 */

import { Action } from '../../../src/components/action';
import { Entity } from '../../../src/components/entity';
import { ModifiableRuntime } from '../../../src/interfaces/modifiable-runtime';
import { QueryableRuntime } from '../../../src/interfaces/queryable-runtime';
import { StoneCard, StoneHero, StoneMinion, StoneGameState } from './entities';
import type { SummonContext, DamageContext, DestroyContext } from './engine-v2';
import type { MinionCard } from '../stearthhone.typed';
import { dealDamage } from './helpers';

// ---------------------------------------------------------------------------
// PlayMinionAction
//
// Handles: moving card to 'played', creating StoneMinion, triggering battlecries.
// Triggers on: 'play_minion'
// ---------------------------------------------------------------------------

export class PlayMinionAction extends Action<
  'play_minion',
  { card: StoneCard; boardPosition: number },
  { minion: StoneMinion }
> {
  public $type: 'play_minion' = 'play_minion';

  protected async doApply(
    runtime: ModifiableRuntime,
  ): Promise<{ minion: StoneMinion }> {
    const { card, boardPosition } = this.parameters;
    const base = card.base as MinionCard;
    const owner = card.owner;

    // Pay mana.
    owner.mana -= base.cost;

    // Remove card from hand.
    card.location = 'played';

    // Shift other minions to make room.
    owner.minions(runtime).forEach((m) => {
      if (m.boardPosition >= boardPosition) m.boardPosition += 1;
    });

    // Spawn a new StoneMinion entity.
    const minion = new StoneMinion(
      `minion-${card[Symbol.for('EntityID') as any]}`,
      owner,
      card,
      base,
    );
    minion.boardPosition = boardPosition;

    // Copy keyword flags from the card class declaration — no text parsing.
    minion.hasTaunt = card.hasTaunt;
    minion.hasDivineShield = card.hasDivineShield;
    minion.hasWindfury = card.hasWindfury;
    minion.hasCharge = card.hasCharge;
    minion.cantAttack = card.cantAttack;
    if (card.hasCharge) {
      minion.canAttackThisTurn = true;
      minion.attacksRemainingThisTurn = card.hasWindfury ? 2 : 1;
    }

    runtime.spawnEntity(minion);

    // Unified summon dispatch: onSummon fires for ALL live minions (including
    // the summoned one). Each card self-filters using context.summoned === self.
    const summonCtx: SummonContext = { summoned: minion, owner };
    for (const m of runtime.entities(StoneMinion)) {
      if (m.pendingDeath) continue;
      m.sourceCard.onSummon(runtime, m, summonCtx);
    }

    return { minion };
  }

  public message(): string {
    return `Played ${this.parameters.card.base.name}.`;
  }
  public prompt(): string {
    return `Play ${this.parameters.card.base.name}`;
  }
  public affectedEntities(): Entity[] {
    return [this.parameters.card];
  }
}

// ---------------------------------------------------------------------------
// AttackAction
//
// Handles combat between minions, minion→hero, hero→minion.
// Triggers on: 'attack'
// Damage is delegated to DealDamageAction, which in turn fires DestroyMinionAction
// if a minion dies. AttackAction itself only tracks attack consumption.
// ---------------------------------------------------------------------------

export class AttackAction extends Action<
  'attack',
  { attacker: StoneMinion | StoneHero; defender: StoneMinion | StoneHero }
> {
  public $type: 'attack' = 'attack';

  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    const { attacker, defender } = this.parameters;

    // Consume attack for this turn.
    attacker.attacksRemainingThisTurn -= 1;
    if (
      attacker instanceof StoneMinion &&
      attacker.attacksRemainingThisTurn <= 0
    ) {
      attacker.canAttackThisTurn = false;
    }

    const defenderAtk = defender instanceof StoneMinion ? defender.attack : 0;

    // Delegate entirely to DealDamageAction — it handles divine shields, fires
    // onDamageTaken for all minions, and processes death via DestroyMinionAction.
    // AttackAction does not need to know about any of that.
    await new DealDamageAction({ source: attacker, target: defender, amount: attacker.attack }).apply(runtime);
    if (defenderAtk > 0) {
      await new DealDamageAction({ source: defender, target: attacker, amount: defenderAtk }).apply(runtime);
    }
  }

  public message(): string {
    return `${this.parameters.attacker} attacks ${this.parameters.defender}.`;
  }
  public prompt(): string {
    return `Attack with ${this.parameters.attacker}`;
  }
  public affectedEntities(): Entity[] {
    return [
      this.parameters.attacker as Entity,
      this.parameters.defender as Entity,
    ];
  }
}

// ---------------------------------------------------------------------------
// DrawCardAction
// ---------------------------------------------------------------------------

export class DrawCardAction extends Action<
  'draw_card',
  { player: StoneHero },
  { drawn: StoneCard | null }
> {
  public $type: 'draw_card' = 'draw_card';

  protected async doApply(
    runtime: ModifiableRuntime,
  ): Promise<{ drawn: StoneCard | null }> {
    const { player } = this.parameters;
    const deck = player.deck(runtime);

    if (deck.length === 0) {
      // Fatigue — deal increasing damage.
      // (fatigue counter would live on StoneGameState or StoneHero)
      player.health -= 1;
      return { drawn: null };
    }

    const card = deck[deck.length - 1]!;

    // Check hand size limit (10 cards).
    const hand = player.hand(runtime);
    if (hand.length >= 10) {
      card.location = 'graveyard'; // "burnt" card
      return { drawn: null };
    }

    card.location = 'hand';
    card.handPosition = hand.length;
    card.onDraw(runtime);
    return { drawn: card };
  }

  public message(): string {
    return `${this.parameters.player} draws a card.`;
  }
  public prompt(): string {
    return 'Draw a card';
  }
  public affectedEntities(_runtime: QueryableRuntime): Entity[] {
    return [];
  }
}

// ---------------------------------------------------------------------------
// EndTurnAction
// ---------------------------------------------------------------------------

export class EndTurnAction extends Action<'end_turn'> {
  public $type: 'end_turn' = 'end_turn';

  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    const phase = runtime.anyEntity(StoneGameState)!;
    const currentPlayer = phase.activePlayer!;

    // End-of-turn lifecycle hooks fire before resetting attack flags.
    for (const m of currentPlayer.minions(runtime)) {
      if (!m.pendingDeath) m.sourceCard.onEndOfTurn(runtime, m);
    }

    // Reset hero power usage.
    currentPlayer.heroPowerUsedThisTurn = false;
    currentPlayer.attacksRemainingThisTurn = 0;

    // Reset all minions' attack flags.
    currentPlayer.minions(runtime).forEach((m) => {
      m.canAttackThisTurn = false;
    });
  }

  public message(): string {
    return 'Turn ended.';
  }
  public prompt(): string {
    return 'End Turn';
  }
  public affectedEntities(): Entity[] | void {
    return;
  }
}

// ---------------------------------------------------------------------------
// DestroyMinionAction
//
// Defined before DealDamageAction because DealDamageAction references it.
// Handles the full death sequence: marks pendingDeath, dispatches onDestroy
// to every live minion (deathrattles push SummonMinionActions to triggerStack),
// then removes the entity.
// ---------------------------------------------------------------------------

export class DestroyMinionAction extends Action<
  'destroy_minion',
  { minion: StoneMinion; source: Entity | null }
> {
  public $type: 'destroy_minion' = 'destroy_minion';

  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    const { minion } = this.parameters;
    if (minion.pendingDeath) return; // already being processed

    minion.pendingDeath = true;

    // Dispatch onDestroy to ALL live minions (unified dispatch, each self-filters).
    // Deathrattle cards push deferred actions onto gameState.triggerStack here.
    const ctx: DestroyContext = { destroyed: minion, owner: minion.owner };
    for (const m of runtime.entities(StoneMinion)) {
      if (m.pendingDeath && m !== minion) continue;
      m.sourceCard.onDestroy(runtime, m, ctx);
    }

    runtime.destroyEntity(minion);
  }

  public message(): string {
    return `${this.parameters.minion} is destroyed.`;
  }
  public prompt(): string {
    return `Destroy minion`;
  }
  public affectedEntities(): Entity[] {
    return [this.parameters.minion];
  }
}

// ---------------------------------------------------------------------------
// DealDamageAction
//
// The canonical way to deal damage to any target. Used by:
//   - AttackAction (combat hits)
//   - Spell actions (e.g. Fireball)
//   - Card lifecycle hooks (FireImp battlecry, Ragnaros end-of-turn)
//
// Applies divine-shield / armor absorption, dispatches onDamageTaken to
// ALL live minions (each self-filters), then triggers DestroyMinionAction
// if the target dies. Any trigger listening for 'deal_damage' fires here
// regardless of what caused the damage.
// ---------------------------------------------------------------------------

export class DealDamageAction extends Action<
  'deal_damage',
  { source: Entity | null; target: StoneMinion | StoneHero; amount: number }
> {
  public $type: 'deal_damage' = 'deal_damage';

  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    const { source, target, amount } = this.parameters;

    // dealDamage handles divine shield (returns 0) and armor absorption.
    const actualDamage = dealDamage(target, amount);
    if (actualDamage === 0) return;

    // Dispatch onDamageTaken to ALL live minions (unified, each self-filters).
    const ctx: DamageContext = { target, amount: actualDamage, source };
    for (const m of runtime.entities(StoneMinion)) {
      if (!m.pendingDeath) m.sourceCard.onDamageTaken(runtime, m, ctx);
    }

    // If a minion reached 0 HP, process its death as a dedicated action.
    if (target instanceof StoneMinion && target.health <= 0 && !target.pendingDeath) {
      await new DestroyMinionAction({ minion: target, source }).apply(runtime);
    }
  }

  public message(): string {
    return `Deal ${this.parameters.amount} damage to ${this.parameters.target}.`;
  }
  public prompt(): string {
    return `Deal ${this.parameters.amount} damage`;
  }
  public affectedEntities(): Entity[] {
    return [this.parameters.target];
  }
}

// ---------------------------------------------------------------------------
// SummonMinionAction
//
// Spawns a token or deathrattle minion directly onto the board.
// Used by cards that create minions programmatically (HarvestGolem, etc.).
// Cards push this onto gameState.triggerStack inside their lifecycle hooks
// so the spawning is deferred and MCTS-safe.
// ---------------------------------------------------------------------------

export class SummonMinionAction extends Action<
  'summon_minion',
  {
    CardClass: { new (id: string, owner: StoneHero): StoneCard; stats: import('../stearthhone.typed').MinionCard };
    owner: StoneHero;
    boardPosition: number;
  },
  { minion: StoneMinion }
> {
  public $type: 'summon_minion' = 'summon_minion';

  protected async doApply(
    runtime: ModifiableRuntime,
  ): Promise<{ minion: StoneMinion }> {
    const { CardClass, owner, boardPosition } = this.parameters;
    const suffix = Math.random().toString(36).slice(2, 8);
    const tokenCard = new CardClass(`token-card-${suffix}`, owner);
    (tokenCard as any).location = 'played';

    // Shift existing minions to make room.
    owner.minions(runtime).forEach((m) => {
      if (m.boardPosition >= boardPosition) m.boardPosition += 1;
    });

    const minion = new StoneMinion(
      `token-minion-${suffix}`,
      owner,
      tokenCard,
      CardClass.stats,
    );
    minion.boardPosition = boardPosition;
    minion.hasTaunt = tokenCard.hasTaunt;
    minion.hasDivineShield = tokenCard.hasDivineShield;
    minion.hasWindfury = tokenCard.hasWindfury;
    minion.hasCharge = tokenCard.hasCharge;
    minion.cantAttack = tokenCard.cantAttack;

    runtime.spawnEntity(tokenCard);
    runtime.spawnEntity(minion);

    // Unified summon dispatch: every live minion (including the token) sees this.
    const summonCtx: SummonContext = { summoned: minion, owner };
    for (const m of runtime.entities(StoneMinion)) {
      if (!m.pendingDeath) m.sourceCard.onSummon(runtime, m, summonCtx);
    }

    return { minion };
  }

  public message(): string {
    return `Summon ${this.parameters.CardClass.stats.name}.`;
  }
  public prompt(): string {
    return `Summon ${this.parameters.CardClass.stats.name}`;
  }
  public affectedEntities(): Entity[] {
    return [];
  }
}
