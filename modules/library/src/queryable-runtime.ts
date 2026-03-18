import { Entity } from './entity';
import { Game } from './game';
import { GameState, GameParameters, Class } from './game.types';

/**
 * Runtime models the capabilities of the runtime, which only holds query information.
 * No other methods, functionality or properties from the normal game are exposed.
 */
export interface QueryableRuntime<
  GAME extends Game<STATE, PARAMETERS>,
  STATE extends GameState,
  PARAMETERS extends GameParameters | undefined,
> {
  entities<TYPE extends Entity<STATE>>(type: Class<TYPE>): ReadonlyArray<TYPE>;
  entities(): ReadonlyArray<Entity<STATE>>;

  entitySet<TYPE extends Entity<STATE>>(type: Class<TYPE>): ReadonlySet<TYPE>;
  entitySet(): ReadonlySet<Entity<STATE>>;
}
