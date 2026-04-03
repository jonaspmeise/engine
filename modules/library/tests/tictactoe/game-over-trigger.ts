import { Action } from '../../src/components/action';
import { Choice } from '../../src/components/choice';
import { Trigger, TriggerReturnType } from '../../src/components/trigger';
import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';
import { Draw } from './draw';
import { Lane } from './lane';
import { MarkAction } from './mark';
import { Win } from './win';

export class GameOverTrigger extends Trigger {
  apply(
    state: QueryableRuntime,
    lastChoice: Choice<Action<any>> | undefined,
  ): TriggerReturnType[] | void {
    if (!(lastChoice?.execution instanceof MarkAction)) {
      return;
    }

    console.log(
      'Lanes are',
      state.entities(Lane).map((lane) => lane.wonBy(state)),
    );

    const winningPlayer = state
      .entities(Lane)
      .map((lane) => lane.wonBy(state))
      .filter((player) => player !== undefined)[0];

    const isDraw =
      winningPlayer === undefined &&
      state.entities(Lane).every((lane) => lane.isFull(state));

    if (isDraw) {
      return [new Choice(new Draw(), lastChoice.player)];
    } else if (winningPlayer !== undefined) {
      return [new Choice(new Win({ player: winningPlayer }), winningPlayer)];
    } else {
      return;
    }
  }
}
