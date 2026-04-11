import { Action } from '../components/action';
import { Choice } from '../components/choice';
import { Entity } from '../components/entity';
import { GameEndParameters } from './game.types';
import { PlayerInterface } from '../interfaces/player-interface';
import { QueryableRuntime } from './queryable-runtime';

/**
 * @see ModifiableRuntime models the capabilities of the runtime, which allows querying of entities in addition to modifying them.
 */
export interface ModifiableRuntime extends QueryableRuntime {
  destroyEntity(entity: Entity): void;
  spawnEntity(entity: Entity): void;
  end(parameters: Partial<GameEndParameters>): void;
  prompt<T extends Choice<Action<string, any, any>>>(
    player: PlayerInterface,
    choices: T[],
  ): Promise<T extends Choice<infer A> ? A : never>;
}
