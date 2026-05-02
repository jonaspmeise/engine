import {
  Entity,
  PlayerInterface,
  playerInterfaceMarker,
  EntityID,
} from '../../../src';
import { Mark } from '../tictactoe.typed';

export class TicTacToePlayer extends Entity implements PlayerInterface {
  public static readonly $type: string = 'TicTacToePlayer';
  public $type: string = 'TicTacToePlayer';

  constructor(
    public readonly mark: Mark,
    public isCurrentPlayer: boolean,
  ) {
    super(`player-${mark}`);
  }
  [playerInterfaceMarker] = true as const;

  generateId(): EntityID {
    return `player-${this.mark}`;
  }

  toString(): string {
    return `Player ${this.mark}`;
  }
}
