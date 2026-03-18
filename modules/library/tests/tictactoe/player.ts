import { Entity } from '../../src/entity';
import { EntityID } from '../../src/entity.types';
import { Mark, TicTacToeState } from './tictactoe.typed';

// TODO: A player should be easily markeable as PlayerInstance<>, so that we can link an entity to be an Avatar of a player...
export class TicTacToePlayer extends Entity<TicTacToeState> {
  constructor(
    public readonly mark: Mark,
    public isCurrentPlayer: boolean,
  ) {
    super();
  }

  persist(state: TicTacToeState): void {
    // Player state is not changed during runtime!
  }

  generateId(): EntityID {
    return `player-${this.mark}`;
  }
}
