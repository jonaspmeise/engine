import { Action } from '../../src/components/action';
import { Choice } from '../../src/components/choice';
import { Trigger, TriggerReturnType } from '../../src/components/trigger';
import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';
import { Lane } from './lane';
import { MarkAction } from './mark';

export class GameOverTrigger extends Trigger {
  apply(
    state: QueryableRuntime,
    lastChoice: Choice<Action<any>> | undefined,
  ): TriggerReturnType[] | void {
    if (!(lastChoice?.execution instanceof MarkAction)) {
      return;
    }

    const winningPlayer = state
      .entities(Lane)
      .map((lane) => lane.wonBy(state))
      .filter((player) => player !== undefined)[0];

    const isDraw =
      winningPlayer === undefined &&
      state.entities(Lane).every((lane) => lane.isFull(state));

    return [
      (runtime) => {
        if (winningPlayer !== undefined) {
          // TODO: "toString() on player?"
          console.log(
            `Game over! Player ${winningPlayer.mark} has won the game!`,
          );
          runtime.end({ winners: [winningPlayer] });
        } else if (isDraw) {
          console.log('Game over! It is a draw!');
          runtime.end({ draws: state.players() });
        }
      },
    ];
  }
}
