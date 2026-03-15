import { QueryableRuntime } from '../../src/queryable-runtime';
import { Lane } from './lane';
import { Slot } from './slot';
import { TicTacToe } from './tictactoe';
import { TicTacToeState } from './tictactoe.typed';

export class DiagonalLane extends Lane {
  public slots(
    runtime: QueryableRuntime<TicTacToe, TicTacToeState, any>,
  ): Set<Slot> {
    return new Set(
      Array.from(runtime.entities(Slot)).filter((slot) =>
        this.index === 0 ? slot.x === slot.y : slot.x === 2 - slot.y,
      ),
    );
  }
}
