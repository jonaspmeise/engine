import { Action } from '../../../src/components/action';
import { Choice } from '../../../src/components/choice';
import { Trigger, TriggerReturnType } from '../../../src/components/trigger';
import { QueryableRuntime } from '../../../src/interfaces/queryable-runtime';
import { Draw } from '../actions/draw';
import { MarkAction } from '../actions/mark';
import { Win } from '../actions/win';
import { Lane } from '../entities/lane';

export class GameOverTrigger implements Trigger {
  public readonly name: string = 'check-for-game-over';

  apply(
    state: QueryableRuntime,
    lastChoice: Choice<Action<string, any>> | undefined,
  ): TriggerReturnType[] | void {
    if (!(lastChoice?.execution instanceof MarkAction)) {
      return;
    }

    const winningPlayer = state
      .entities(Lane)
      .map((lane) => lane.wonBy(state))
      .filter((player) => player !== undefined)[0];

    if (winningPlayer !== undefined) {
      return [new Choice(new Win({ player: winningPlayer }), winningPlayer)];
    }

    const isDraw = state.entities(Lane).every((lane) => lane.isFull(state));

    if (isDraw) {
      return [new Choice(new Draw(), lastChoice.player)];
    }
  }
}
