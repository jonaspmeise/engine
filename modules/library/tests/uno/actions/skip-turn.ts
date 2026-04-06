import {
  Action,
  Entity,
  ModifiableRuntime,
  PlayerEntity,
  QueryableRuntime,
} from '../../../src';
import { UnoMeta } from '../entities/meta';

export class UnoPassTurnAction extends Action<'pass_turn', {}> {
  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    const meta = runtime.anyEntity(UnoMeta)!;
    meta.currentPlayerIndex++;
  }

  public $type: 'pass_turn' = 'pass_turn';
  public message(player: PlayerEntity): string {
    return `${player} passed their turn.`;
  }
  public prompt(): string {
    return `Pass your turn.`;
  }
  public affectedEntities(runtime: QueryableRuntime): Entity[] | void {
    return [runtime.anyEntity(UnoMeta)!.currentPlayer()];
  }
}
