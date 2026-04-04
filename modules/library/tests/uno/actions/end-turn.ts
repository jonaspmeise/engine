import {
  Action,
  entityId,
  EntityID,
  ModifiableRuntime,
  PlayerInterface,
  QueryableRuntime,
} from '../../../src';
import { UnoMeta } from '../entities/meta';

export class UnoEndTurn extends Action<'end_turn'> {
  apply(runtime: ModifiableRuntime): void {
    const meta = runtime.anyEntity(UnoMeta)!;

    // Transfer current player's turn to the next player.
    meta.currentPlayerIndex =
      (meta.currentPlayerIndex + 1) % meta.players.length;
  }
  public message(player: PlayerInterface): string {
    return `${player}'s turn is skipped!`;
  }
  public prompt(): string {
    throw new Error('End your turn.');
  }
  public affectedEntities(runtime: QueryableRuntime): EntityID[] | void {
    return [runtime.anyEntity(UnoMeta)![entityId]];
  }

  public $type: 'end_turn' = 'end_turn';
}
