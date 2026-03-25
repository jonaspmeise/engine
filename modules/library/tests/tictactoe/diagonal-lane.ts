import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';
import { Lane } from './lane';
import { Slot } from './slot';

export class DiagonalLane extends Lane {
  public type: string = 'diagonal-lane';
  public slots(runtime: QueryableRuntime): Set<Slot> {
    return new Set(
      Array.from(runtime.entities(Slot)).filter((slot) =>
        this.index === 0 ? slot.x === slot.y : slot.x === 2 - slot.y,
      ),
    );
  }
}
