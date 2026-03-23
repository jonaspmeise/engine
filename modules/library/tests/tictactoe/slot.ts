import { Entity } from '../../src/components/entity';
import { EntityID } from '../../src/components/entity.types';
import { TicTacToePlayer } from './player';

export class Slot extends Entity {
  public markedBy: TicTacToePlayer | null = null;

  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {
    super();
  }

  generateId(): EntityID {
    return `slot-${this.x}-${this.y}`;
  }
}
