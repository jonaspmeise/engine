import { TicTacToePlayer } from './player';
import { Action } from '../../src/components/action';
import { ModifiableRuntime, QueryableRuntime, EntityID } from '../../src';

/**
 * Because this Action should
 * - be animated
 * - be logged
 * we explicitly model it as an Action for this game.
 * It doesn't do much, just internally wraps the ending-of-the-game logic.
 */
export class Win extends Action<{
  player: TicTacToePlayer;
}> {
  apply(runtime: ModifiableRuntime): void {
    runtime.end({
      winners: [this.parameters.player],
      losers: runtime
        .players()
        .filter((player) => player !== this.parameters.player),
    });
  }

  public message(): string {
    return `${this.parameters.player} wins!`;
  }
  public prompt(): string {
    return `Win the game!`;
  }
  public affectedEntities(_runtime: QueryableRuntime): EntityID[] | void {
    // Does not matter, because this never exists as a choice.
  }

  public $type = 'Win';
}
