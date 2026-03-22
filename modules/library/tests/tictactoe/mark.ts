import { Action } from '../../src/components/action';
import { ModifiableRuntime } from '../../src/interfaces/modifiable-runtime';
import { TicTacToePlayer } from './player';
import { Slot } from './slot';
import { TicTacToeState } from './tictactoe.typed';

export class MarkAction extends Action<
  TicTacToeState,
  {
    slot: Slot;
    player: TicTacToePlayer; // or automate this somehow...?
  }
> {
  apply(
    _runtime: ModifiableRuntime<TicTacToeState>,
    parameters: {
      slot: Slot;
      player: TicTacToePlayer;
    },
  ): void {
    parameters.slot.markedBy = parameters.player;
  }
}
