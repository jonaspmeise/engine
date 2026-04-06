import { Choice } from '../components/choice';
import { Entity } from '../components/entity';
import { GameEndParameters } from '../game.types';
import { PlayerInterface } from './player-interface';
import { QueryableRuntime } from './queryable-runtime';

/**
 * @see ModifiableRuntime models the capabilities of the runtime, which allows querying of entities in addition to modifying them.
 */
export interface ModifiableRuntime extends QueryableRuntime {
  destroyEntity(entity: Entity): void;
  spawnEntity(entity: Entity): void;
  end(parameters: Partial<GameEndParameters>): void;
  // TODO: Choices are abstract. There are default choices (a button-dialogue, e.g.) or action choices.
  prompt<CHOICES extends Choice<any>[]>(
    player: PlayerInterface,
    choices: [...CHOICES],
    message?: string,
  ): Promise<CHOICES[number] extends Choice<infer T> ? T : never>;
}
