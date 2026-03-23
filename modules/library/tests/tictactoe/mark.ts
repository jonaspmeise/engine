import { Action } from '../../src/components/action';
import { ModifiableRuntime } from '../../src/interfaces/modifiable-runtime';
import { TicTacToePlayer } from './player';
import { Slot } from './slot';

export class MarkAction extends Action<{
  slot: Slot;
  player: TicTacToePlayer; // or automate this somehow...?
}> {
  apply(
    _runtime: ModifiableRuntime,
    parameters: {
      slot: Slot;
      player: TicTacToePlayer;
    },
  ): void {
    parameters.slot.markedBy = parameters.player;
  }
}
