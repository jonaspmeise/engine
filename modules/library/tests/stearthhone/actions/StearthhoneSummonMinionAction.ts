import {
  Action,
  ModifiableRuntime,
  Entity,
  QueryableRuntime,
} from '../../../src';
import { entityId } from '@my-engine/library';
import { StearthhoneMinion } from '../entities/StearthhoneMinion';
import { StearthhoneBoard } from '../entities/StearthhoneBoard';

export class StearthhoneSummonMinionAction extends Action<
  'summon_minion',
  { card: StearthhoneMinion; boardPosition: number }
> {
  public $type: 'summon_minion' = 'summon_minion';

  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    const card = this.parameters.card;
    const board = runtime
      .entities(StearthhoneBoard)
      .filter((b) => b.owner[entityId] === card.owner[entityId])[0]!;

    // Shift other minions to make room.
    board.cards(runtime).forEach((m) => {
      if (m.position >= this.parameters.boardPosition) {
        m.position += 1;
      }
    });

    // Spawn a new StearthhoneMinion entity.
    card.location = board;
    if (card.properties.charge) {
      card.attacksRemainingThisTurn = card.properties.windfury ? 2 : 1;
    }
  }

  public canApply(runtime: QueryableRuntime): boolean {
    const board = runtime
      .entities(StearthhoneBoard)
      .filter(
        (b) => b.owner[entityId] === this.parameters.card.owner[entityId],
      )[0]!;

    return board.cards(runtime).length < 7;
  }

  public message(): string {
    return `Summoned ${this.parameters.card.name}.`;
  }
  public prompt(): string {
    return `Summon ${this.parameters.card.name}`;
  }
  public affectedEntities(): Entity[] {
    return [this.parameters.card];
  }
}
