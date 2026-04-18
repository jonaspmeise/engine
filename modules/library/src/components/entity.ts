import { PlayerEntity } from '../services/entity/entity-service.types';
import { EntityID } from './entity.types';

export const entityId: unique symbol = Symbol('EntityID');

/**
 * Models the base class of all entities.
 * Entities are the core of the game and are defined by its Domain - Cards, Zones, Dice, Players, ..., but also more abstract things like "Player's hand", "Player's board", etc. can be modeled as entities.
 * Entities might have mutable and non-mutable state and are modified by Actions.
 * They should not have any logic in them, but only represent the current state of a thing in the game.
 */
export abstract class Entity {
  /**
   * The type of this entity, which is used to identify the type of this entity at runtime.
   * This should usually just be a reference to the constructor of this entity, but might be problematic with minified code, so it should explicitally be encoded.
   */
  public abstract readonly $type: string;

  /**
   * A string representation for this entity, which appears in logs, the UI, ...
   */
  public abstract toString(): string;

  public readonly [entityId]: EntityID;

  /**
   * Returns a version of this entity, which only contains the information that is visible to the given player.
   * This is used to ensure that players only receive information about the game state that they are supposed to have.
   * By default, all information is visible.
   * Classes extending Entity can override this method to implement custom visibility logic.
   * @param _player The player for whom the visibility is being calculated.
   * @returns A partial version of this entity, with private information removed.
   */
  public visibility(_player: PlayerEntity): Partial<this> {
    return this;
  }

  /**
   * Constructs a new entity with the given ID.
   * @param id An unique ID across all entities.
   */
  constructor(id: EntityID) {
    this[entityId] = id;
  }
}
