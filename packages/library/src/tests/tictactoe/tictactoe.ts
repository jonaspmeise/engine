import { Entity } from '../../entity';
import { Game } from '../../game';
import { Slot } from './slot';
import { TicTacToeState, TicTacToeParameters } from './tictactoe.typed';


export class TicTacToe extends Game<TicTacToeState, TicTacToeParameters> {

  * enrichen(state: TicTacToeState): Generator<Entity<TicTacToeState>, void, null> {
    for(let x = 0; x < 3; x++) {
      for(let y = 0; y < 3; y++) {
        yield new Slot(x, y);
      }
    }
  }
  
  initialize(parameters: TicTacToeParameters): TicTacToeState {
    return {
      board: Array(9).fill(null),
      currentPlayer: parameters.firstPlayer
    }
  }
}