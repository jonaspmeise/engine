import { Entity } from '../../src/components/entity';
import { EntityID } from '../../src/components/entity.types';
import { Slot } from './slot';
import { TicTacToeState } from './tictactoe.typed';
import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';

export abstract class Lane extends Entity<TicTacToeState> {
  constructor(public readonly index: number) {
    super();
  }

  public abstract slots(runtime: QueryableRuntime<TicTacToeState>): Set<Slot>;

  public persist(_state: TicTacToeState): void {
    // Do nothing, because this class is purely ergonomic and does _not_ have any
    // non-readonly properties.
  }

  public generateId(): EntityID {
    return `lane-${this.constructor.name}-${this.index}`;
  }
}
