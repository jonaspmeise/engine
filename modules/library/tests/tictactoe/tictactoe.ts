import { TicTacToeState, TicTacToeParameters, Mark } from './tictactoe.typed';
import { Game } from '../../src/game';
import { Entity } from '../../src/entity';
import { Slot } from './slot';
import { MarkAction } from './mark';
import { Action } from '../../src/action';
import { TicTacToePlayer } from './player';
import { VerticalLane } from './vertical-lane';
import { QueryableRuntime } from '../../src/queryable-runtime';

export class TicTacToe extends Game<TicTacToeState, TicTacToeParameters> {
  actions(): Set<Action<TicTacToeState, any>> {
    return new Set([new MarkAction()]);
  }

  public readonly name: string = 'Tic-Tac-Toe';

  *enrichen(
    state: TicTacToeState,
    runtime: QueryableRuntime<TicTacToe, TicTacToeState, TicTacToeParameters>,
  ): Generator<Entity<TicTacToeState>, void, undefined> {
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        yield new Slot(x, y);
      }
    }

    // Lanes.
    for (let i = 0; i < 3; i++) {
      // Horizontal.

      // Vertical.
      yield new VerticalLane(i);
    }

    // Players.
    const marks: Mark[] = ['X', 'O'];
    for (let i = 0; i < 2; i++) {
      yield new TicTacToePlayer(marks[i], state.currentPlayer === marks[i]);
    }
  }

  initialize(parameters: TicTacToeParameters): TicTacToeState {
    return {
      board: Array(9).fill(null),
      currentPlayer: parameters.firstPlayer,
    };
  }
}
