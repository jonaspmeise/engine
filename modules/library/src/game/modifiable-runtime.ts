import { Entity } from '../components/entity';
import { EntityFlushCallback } from '../services/entity/entity-service.types';
import { GameEndParameters } from './game.types';
import { GraphRuntime } from './graph-runtime';

/**
 * @see ModifiableRuntime models the capabilities of the runtime, which allows querying of entities in addition to modifying them.
 * // TODO: Put comments from implementation here instead!
 */
export interface ModifiableRuntime extends GraphRuntime {
  destroyEntity(entity: Entity): void;
  spawnEntity(entity: Entity): void;
  end(parameters: Partial<GameEndParameters>): void;
  flush: EntityFlushCallback;
}
