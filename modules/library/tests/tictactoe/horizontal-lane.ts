import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';
import { Lane } from './lane';
import { Slot } from './slot';
import { TicTacToe } from './tictactoe';
import { TicTacToeState } from './tictactoe.typed';

export class HorizontalLane extends Lane {
  public slots(
    runtime: QueryableRuntime<TicTacToe, TicTacToeState, any>,
  ): Set<Slot> {
    return new Set(
      Array.from(runtime.entities(Slot)).filter(
        (slot) => slot.y === this.index,
      ),
    );
  }
}
