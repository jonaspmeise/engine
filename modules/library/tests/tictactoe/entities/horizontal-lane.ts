import { Lane } from './lane';
import { Slot } from './slot';
import { QueryableRuntime } from '@my-engine/library';

export class HorizontalLane extends Lane {
  public toString(): string {
    return `Horizontal Lane #${this.index}`;
  }
  public $type: string = 'horizontal-lane';
  public slots(runtime: QueryableRuntime): Set<Slot> {
    return new Set(
      Array.from(runtime.entities(Slot)).filter(
        (slot) => slot.y === this.index,
      ),
    );
  }
}
