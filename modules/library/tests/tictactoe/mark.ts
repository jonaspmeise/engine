import { Action } from '../../src/components/action';
import { EntityID } from '../../src/components/entity.types';
import { ModifiableRuntime } from '../../src/interfaces/modifiable-runtime';
import { TicTacToePlayer } from './player';
import { Slot } from './slot';

export class MarkAction extends Action<{
  slot: Slot;
  player: TicTacToePlayer;
}> {
  public message(): string {
    return `Player ${this.parameters.player.mark} marked slot ${this.parameters.slot.id}!`;
  }

  public prompt(): string {
    return `Mark slot ${this.parameters.slot.id} with ${this.parameters.player.mark}`;
  }

  public affectedEntities(): EntityID[] | void {
    return [this.parameters.slot.id];
  }

  public type: string = 'mark';

  apply(_runtime: ModifiableRuntime): void {
    this.parameters.slot.markedBy = this.parameters.player;
  }
}
