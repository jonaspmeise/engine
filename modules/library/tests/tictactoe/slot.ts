import { Entity } from '../../src/entity';
import { EntityID } from '../../src/entity.types';
import { QueryableRuntime } from '../../src/queryable-runtime';
import { TicTacToePlayer } from './player';
import { TicTacToeState } from './tictactoe.typed';

export class Slot extends Entity<TicTacToeState> {
  public markedBy: TicTacToePlayer | null = null;

  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {
    super();
  }

  persist(
    state: TicTacToeState,
    runtime: QueryableRuntime<any, TicTacToeState, any>,
  ): void {
    // TODO: The "3" is implied through the parameters, but should be passed.

    state.board[this.y * 3 + this.x] = this.markedBy?.mark || null;
  }
  generateId(): EntityID {
    return `slot-${this.x}-${this.y}`;
  }
}
