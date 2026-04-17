import { Action, ModifiableRuntime } from '../../../src';
import { UnoMeta } from '../entities/meta';

export class UnoEndTurnAction extends Action<'end_turn'> {
  public async doApply(runtime: ModifiableRuntime): Promise<void> {
    const meta = runtime.anyEntity(UnoMeta)!;

    // Transfer current player's turn to the next player.
    meta.currentPlayerIndex =
      (meta.currentPlayerIndex + 1) % meta.players.length;
  }
  public $type: 'end_turn' = 'end_turn';
}
