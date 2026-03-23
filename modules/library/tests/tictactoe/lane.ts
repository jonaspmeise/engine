import { Entity } from '../../src/components/entity';
import { EntityID } from '../../src/components/entity.types';
import { Slot } from './slot';
import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';

export abstract class Lane extends Entity {
  constructor(public readonly index: number) {
    super();
  }

  public abstract slots(runtime: QueryableRuntime): Set<Slot>;

  public generateId(): EntityID {
    return `lane-${this.constructor.name}-${this.index}`;
  }
}
