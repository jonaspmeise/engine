import { Action } from '../../src/components/action';
import { ModifiableRuntime } from '../../src/interfaces/modifiable-runtime';
import { TicTacToePlayer } from './player';
import { Slot } from './slot';

export class MarkAction extends Action<{
  slot: Slot;
  player: TicTacToePlayer;
}> {
  public name: string = 'mark';

  apply(_runtime: ModifiableRuntime): void {
    this.parameters.slot.markedBy = this.parameters.player;
  }
}
