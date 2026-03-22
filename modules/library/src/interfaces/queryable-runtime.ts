import { Entity } from '../components/entity';
import { GameState, Class } from '../game.types';

/**
 * @see QueryableRuntime models the capabilities of the runtime, which only holds query information.
 * No other methods, functionality or properties from the normal game are exposed.
 */
export interface QueryableRuntime<STATE extends GameState> {
  entities<TYPE extends Entity<STATE>>(type: Class<TYPE>): ReadonlyArray<TYPE>;
  entities(): ReadonlyArray<Entity<STATE>>;

  entitySet<TYPE extends Entity<STATE>>(type: Class<TYPE>): ReadonlySet<TYPE>;
  entitySet(): ReadonlySet<Entity<STATE>>;

  anyEntity<TYPE extends Entity<STATE>>(type: Class<TYPE>): TYPE | null;
}
