import {
  Action,
  entityId,
  EntityID,
  ModifiableRuntime,
  PlayerEntity,
  QueryableRuntime,
} from '../../../src';
import { UnoPlayer } from '../entities/player';

export class UnoWinGameAction extends Action<
  'WinGame',
  {
    player: UnoPlayer;
  }
> {
  apply(runtime: ModifiableRuntime): void {
    runtime.end({
      winners: [this.parameters.player],
      losers: runtime
        .players()
        .filter((player) => player !== this.parameters.player),
    });
  }
  public message(player: PlayerEntity): string {
    return `${this.parameters.player} wins the game!`;
  }
  public prompt(): string {
    return `Win the game.`;
  }
  public affectedEntities(runtime: QueryableRuntime): EntityID[] | void {
    return [this.parameters.player[entityId]];
  }

  public $type: 'WinGame' = 'WinGame';
}
