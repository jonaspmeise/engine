import { Entity, QueryableRuntime, entityId } from '../../../src';
import { TicTacToePlayer } from './player';
import { Slot } from './slot';

export abstract class Lane extends Entity {
  constructor(public readonly index: number) {
    super(`${new.target.name}-${index}`);
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
