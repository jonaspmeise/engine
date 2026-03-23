import { Entity } from '../../src/components/entity';
import { EntityID } from '../../src/components/entity.types';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../../src/interfaces/player-interface';
import { Mark } from './tictactoe.typed';

export class TicTacToePlayer extends Entity implements PlayerInterface {
  constructor(
    public readonly mark: Mark,
    public isCurrentPlayer: boolean,
  ) {
    super();
  }
  [playerInterfaceMarker] = true as const;

  generateId(): EntityID {
    return `player-${this.mark}`;
  }
}
