import { Action } from '../../src/components/action';
import { Choice } from '../../src/components/choice';
import { Executable } from '../../src/components/choice.types';
import { Trigger } from '../../src/components/trigger';
import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';
import { MarkAction } from './mark';
import { TicTacToePlayer } from './player';

export class ChangeTurnTrigger extends Trigger {
  apply(
    _state: QueryableRuntime,
    lastChoice: Choice<Action<string, any>> | undefined,
  ): (Choice<Action<string, any>> | Executable)[] | void {
    if (!(lastChoice?.execution instanceof MarkAction)) {
      return;
    }

    // We directly modify the game state here.
    // Alternatively, we could also create an own "ChangeTurn" action and return a choice that triggers this action here.
    // Because the "ChangeTurn" is never used by itself in the game, we skip modeling it.
    return [
      (runtime) => {
        const players = runtime.entities(TicTacToePlayer);

        // Swap players around!
        players.forEach((player) => {
          player.isCurrentPlayer = !player.isCurrentPlayer;
        });
      },
    ];
  }
}
