import { Entity } from '../components/entity';
import { QueryableRuntime } from './queryable-runtime';

/**
 * @see ModifiableRuntime models the capabilities of the runtime, which allows querying of entities in addition to modifying them.
 */
export interface ModifiableRuntime extends QueryableRuntime {
  destroyEntity(entity: Entity): void;
  spawnEntity(entity: Entity): void;
}
