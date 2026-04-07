import { Action, ModifiableRuntime, Entity } from '../../../../src';
import { MinionCard } from '../../stearthhone.typed';
import { SummonContext } from '../engine-v2';
import { StoneCard, StoneMinion } from '../entities';
import { entityId } from '@my-engine/library';

export class StearthhonePlayMinionAction extends Action<
  'play_minion',
  { card: StoneCard; boardPosition: number }
> {
  public $type: 'play_minion' = 'play_minion';

  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
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
      `minion-${card[entityId]}`,
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
