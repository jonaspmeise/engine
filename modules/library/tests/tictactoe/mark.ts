import { Action } from '../../src/action';
import { TicTacToePlayer } from './player';
import { Slot } from './slot';
import { TicTacToeState } from './tictactoe.typed';

export class MarkAction extends Action<TicTacToeState, {
  slot: Slot,
  player: TicTacToePlayer // or automate this somehow...?
}> {
  apply(state: TicTacToeState, parameters: {
    slot: Slot,
    player: TicTacToePlayer
  }): void {
    parameters.slot.markedBy = parameters.player;
  }
};