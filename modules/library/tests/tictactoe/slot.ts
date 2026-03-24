import { Entity } from '../../src/components/entity';
import { TicTacToePlayer } from './player';

export class Slot extends Entity {
  public markedBy: TicTacToePlayer | null = null;

  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {
    super(`slot-${x}-${y}`);
  }
}
