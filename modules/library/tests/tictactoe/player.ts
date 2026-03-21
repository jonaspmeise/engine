import { Entity } from '../../src/entity';
import { EntityID } from '../../src/entity.types';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../../src/player-interface';
import { Mark, TicTacToeState } from './tictactoe.typed';

export class TicTacToePlayer
  extends Entity<TicTacToeState>
  implements PlayerInterface<TicTacToeState>
{
  constructor(
    public readonly mark: Mark,
    public isCurrentPlayer: boolean,
  ) {
    super();
  }
  [playerInterfaceMarker] = true as const;

  persist(state: TicTacToeState): void {
    // Player state is not changed during runtime!
  }

  generateId(): EntityID {
    return `player-${this.mark}`;
  }
}
