import { ModifiableRuntime, QueryableRuntime, EntityID } from '../../src';
import { Action } from '../../src/components/action';

/**
 * Because this Action should
 * - be animated
 * - be logged
 * we explicitly model it as an Action for this game.
 * It doesn't do much, just internally wraps the ending-of-the-game logic.
 */
export class Draw extends Action<'draw'> {
  apply(runtime: ModifiableRuntime): void {
    runtime.end({
      draws: runtime.players(),
    });
  }

  public $type: 'draw' = 'draw';

  public message(): string {
    return `The game is a draw!`;
  }
  public prompt(): string {
    return `Draw the game!`;
  }
  public affectedEntities(_runtime: QueryableRuntime): EntityID[] | void {
    // Does not matter, because this never exists as a choice.
  }
}
