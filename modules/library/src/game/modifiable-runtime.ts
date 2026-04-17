import { Action } from '../components/action';
import { Entity } from '../components/entity';
import { GameEndParameters } from './game.types';
import { PlayerInterface } from '../interfaces/player-interface';
import { QueryableRuntime } from './queryable-runtime';

/**
 * @see ModifiableRuntime models the capabilities of the runtime, which allows querying of entities in addition to modifying them.
 * // TODO: Put comments from implementation here instead!
 */
export interface ModifiableRuntime extends QueryableRuntime {
  destroyEntity(entity: Entity): void;
  spawnEntity(entity: Entity): void;
  end(parameters: Partial<GameEndParameters>): void;
  prompt<ACTION extends Action<string, any, any>>(
    player: PlayerInterface,
    choices: ACTION[],
  ): Promise<ACTION>;
  execute(
    action: Action<string, any, any>,
  ): Action<string, any, any> | undefined;
}
