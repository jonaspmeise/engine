import { Entity } from '../components/entity';
import { GameState } from '../game.types';
import { QueryableRuntime } from './queryable-runtime';

/**
 * @see ModifiableRuntime models the capabilities of the runtime, which allows querying of entities in addition to modifying them.
 */
export interface ModifiableRuntime<
  STATE extends GameState,
> extends QueryableRuntime<STATE> {
  destroyEntity(entity: Entity<STATE>): void;
  spawnEntity(entity: Entity<STATE>): void;
}
