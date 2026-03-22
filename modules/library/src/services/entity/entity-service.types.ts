import { Entity } from '../../components/entity';
import { GameState } from '../../game.types';
import { PlayerInterface } from '../../interfaces/player-interface';

/**
 * Is called, when the internal state of an entity is changed or a new entity is spawned.
 * The engine needs to be informed of such a change, so that it can persist the new state.
 */
export type EntityFlushCallback = (entity: Entity<any>) => void;

export type PlayerEntity<STATE extends GameState> = PlayerInterface<STATE> &
  Entity<STATE>;
