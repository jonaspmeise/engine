import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';
import { Lane } from './lane';
import { Slot } from './slot';

export class HorizontalLane extends Lane {
  public $type: string = 'horizontal-lane';
  public slots(runtime: QueryableRuntime): Set<Slot> {
    return new Set(
      Array.from(runtime.entities(Slot)).filter(
        (slot) => slot.y === this.index,
      ),
    );
  }
}
