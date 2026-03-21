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
    // TODO: This number should come from the parameters - how do we access them?
    // Do we just register an entity that is the game configuration, or is that the task of the developer?
    // Or maybe a separate access method to the game parameters...?
    const boardSize: number = runtime.entities(Slot).length;

    state.board[this.y * boardSize + this.x] = this.markedBy?.mark || null;
  }
  generateId(): EntityID {
    return `slot-${this.x}-${this.y}`;
  }
}
