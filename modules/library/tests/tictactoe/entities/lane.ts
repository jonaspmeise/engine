import {
  Entity,
  ModifiableRuntime,
  QueryableRuntime,
  entityId,
} from '../../../src';
import { AfterAction } from '../../../src/components/lifecyclehooks';
import { MarkAction } from '../actions/mark';
import { TicTacToeWin } from '../actions/win';
import { TicTacToePlayer } from './player';
import { Slot } from './slot';

export abstract class Lane extends Entity implements AfterAction<MarkAction> {
  constructor(public readonly index: number) {
    super(`${new.target.name}-${index}`);
  }

  afterMark(
    runtime: ModifiableRuntime,
    _parameters: { slot: Slot; player: TicTacToePlayer },
  ) {
    const winner = this.wonBy(runtime);
    if (winner !== undefined) {
      runtime.execute(
        new TicTacToeWin({
          player: winner,
          lane: this,
        }),
      );
    }
  }

  public abstract slots(runtime: QueryableRuntime): Set<Slot>;

  public wonBy(runtime: QueryableRuntime): TicTacToePlayer | undefined {
    const slots = Array.from(this.slots(runtime));

    if (
      slots.every(
        (slot) =>
          slot.markedBy?.[entityId] === slots[0]!.markedBy?.[entityId] &&
          !slot.isEmpty(),
      )
    ) {
      return slots[0]!.markedBy!;
    }

    return undefined;
  }

  public isFull(runtime: QueryableRuntime): boolean {
    return Array.from(this.slots(runtime)).every((slot) => !slot.isEmpty());
  }
}
