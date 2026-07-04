import { Action } from './action';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { ChoiceId, dereferenceEntityID } from './choice.types';
import { Entity, entityId } from './entity';

/**
 * This enhanced version of the Choice class is issued by the engine and communicated to the player.
 */
export class EnhancedChoice<ACTION extends Action<string, any>> {
  constructor(
    public readonly id: ChoiceId,
    public readonly execution: ACTION,
    public readonly player: PlayerEntity,
  ) {
    // Should not be serialized!
    Object.defineProperty(this, 'player', {
      enumerable: false,
    });
  }

  // Choices are serialized using a special serializer:
  // Entity references are replaced with a placeholder object (that has the string value "$ENTITY:{{id}}").
  // The client needs to resolve these placeholders back to the actual entities.
  toJSON(): Record<any, unknown> {
    return {
      execution: {
        type: this.execution.$type,
        parameters: EnhancedChoice.dereferenceEntity(this.execution.parameters),
      },
      player: dereferenceEntityID(this.player[entityId]),
      id: this.id,
    };
  }

  protected static dereferenceEntity(object: unknown): unknown {
    if (typeof object !== 'object' || object === null) {
      return object;
    }
    if (object instanceof Entity) {
      return dereferenceEntityID(object[entityId]);
    }
    if (Array.isArray(object)) {
      return object.map((item) => EnhancedChoice.dereferenceEntity(item));
    }
    return Object.fromEntries(
      Object.entries(object as Record<string, unknown>).map(([key, value]) => [
        key,
        EnhancedChoice.dereferenceEntity(value),
      ]),
    );
  }

  static fromAction<ACTION extends Action<string, any>>(
    action: ACTION,
    player: PlayerEntity,
    id: ChoiceId,
  ): EnhancedChoice<ACTION> {
    return new EnhancedChoice(id, action, player);
  }
}
