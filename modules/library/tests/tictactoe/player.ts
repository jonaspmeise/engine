import { Entity } from '../../src/components/entity';
import { EntityID } from '../../src/components/entity.types';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../../src/interfaces/player-interface';
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

  persist(_state: TicTacToeState): void {
    // Player state is not changed during runtime!
  }

  generateId(): EntityID {
    return `player-${this.mark}`;
  }
}
