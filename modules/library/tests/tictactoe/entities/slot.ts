import { TicTacToePlayer } from './player';
import { Entity } from '@my-engine/library';

export class Slot extends Entity {
  public toString(): string {
    return `Slot (${this.x}, ${this.y})`;
  }

  public $type: string = 'slot';
  public markedBy: TicTacToePlayer | null = null;

  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {
    super(`slot-${x}-${y}`);
  }

  public isEmpty(): boolean {
    return this.markedBy === null;
  }
}
