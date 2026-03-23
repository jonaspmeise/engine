import { Entity } from '../../components/entity';
import { PlayerInterface } from '../../interfaces/player-interface';

/**
 * Is called, when the internal state of an entity is changed or a new entity is spawned.
 * The engine needs to be informed of such a change, so that it can persist the new state.
 */
export type EntityFlushCallback = (entity: Entity) => void;

export type PlayerEntity = PlayerInterface & Entity;
