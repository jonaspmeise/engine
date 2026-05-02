import { Lane } from './lane';
import { Slot } from './slot';
import { QueryableRuntime } from '@my-engine/library';

export class VerticalLane extends Lane {
  public static readonly $type: string = 'vertical-lane';
  public toString(): string {
    return `Vertical Lane #${this.index}`;
  }

  public $type: string = 'vertical-lane';

  public slots(runtime: QueryableRuntime): Set<Slot> {
    return new Set(
      Array.from(runtime.entities(Slot)).filter(
        (slot) => slot.x === this.index,
      ),
    );
  }
}
