import { Action, ModifiableRuntime } from '../../../src';
import { UnoMeta } from '../entities/meta';

export class UnoPassTurnAction extends Action<'pass_turn'> {
  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    const meta = runtime.anyEntity(UnoMeta)!;
    meta.currentPlayerIndex =
      (meta.currentPlayerIndex + meta.direction + meta.players.length) %
      meta.players.length;
  }

  public $type: 'pass_turn' = 'pass_turn';
}
