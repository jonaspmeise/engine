import { Entity } from '../components/entity';
import { Class } from './game.types';
import { PlayerEntity } from '../services/entity/entity-service.types';

/**
 * @see QueryableRuntime models the capabilities of the runtime, which only holds query information.
 * No other methods, functionality or properties from the normal game are exposed.
 */
export interface QueryableRuntime {
  entities<TYPE extends Entity>(type: Class<TYPE>): ReadonlyArray<TYPE>;
  entities(): ReadonlyArray<Entity>;
  anyEntity<TYPE extends Entity>(type: Class<TYPE>): TYPE | null;
  players(): ReadonlyArray<PlayerEntity>;
}
