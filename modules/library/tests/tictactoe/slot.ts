import { Entity } from '../../src/entity';
import { EntityID } from '../../src/entity.types';
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

  persist(state: TicTacToeState): void {
    state.board[this.y * 3 + this.x] = this.markedBy?.mark || null;
  }
  identify(): EntityID {
    return `slot-${this.x}-${this.y}`;
  }
}
