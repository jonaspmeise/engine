import { Entity } from '../../src/entity';
import { EntityID } from '../../src/entity.types';
import { Slot } from './slot';
import { TicTacToe } from './tictactoe';
import { TicTacToeState } from './tictactoe.typed';
import { QueryableRuntime } from '../../src/queryable-runtime';

export abstract class Lane extends Entity<TicTacToeState> {
  constructor(public readonly index: number) {
    super();
  }

  public abstract slots(
    runtime: QueryableRuntime<TicTacToe, TicTacToeState, any>,
  ): Set<Slot>;

  public persist(state: TicTacToeState): void {
    // Do nothing, because this class is purely ergonomic and does _not_ have any
    // non-readonly properties.
  }

  public generateId(): EntityID {
    return `lane-${this.constructor.name}-${this.index}`;
  }
}
