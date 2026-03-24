import { Entity } from '../../src/components/entity';
import { Slot } from './slot';
import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';

export abstract class Lane extends Entity {
  constructor(public readonly index: number) {
    super(`lane-${new.target.name}-${index}`);
  }

  public abstract slots(runtime: QueryableRuntime): Set<Slot>;
}
