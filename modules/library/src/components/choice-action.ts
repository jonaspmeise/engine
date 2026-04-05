import { Action } from './action';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { dereferenceEntityID } from './choice.types';
import { Entity, entityId } from './entity';
import { NegativeRule } from './negative-rule';
import { Choice } from '..';

/**
 * A choice is a specific instance of an action that a player can take, including the parameters for that action and a prompt and message to be shown to the player when presenting this choice.
 * This is one of the main objects (besides the raw game state) that is communicated to the player.
 * The player visualizes these choices and can select one of them to execute.
 */
export class ActionChoice<
  ACTION extends Action<string, any, any>,
> extends Choice<ACTION> {
  /**
   * Instantiate a choice.
   * @param execution The action that will be executed when the player selects this choice, including the parameters for that action.
   * Since the object is instantiated, the action and parameters are bound here.
   * @param player The player to who this choice belongs.
   * @param preventedBy A reference to a negative rule that prevents this choice from being executed.
   * This is only sent to clients that request this. This way, the client can show _why_ certain choices can not be executed.
   */
  constructor(
    public readonly execution: ACTION,
    public readonly player: PlayerEntity,
    public readonly preventedBy: NegativeRule | undefined = undefined,
  ) {
    super();

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
        parameters: ActionChoice.dereferenceEntity(this.execution.parameters),
      },
      player: dereferenceEntityID(this.player[entityId]), // TODO: Structurally define this somewhere as an utility function!
      preventedBy:
        this.preventedBy === undefined ? undefined : this.preventedBy.name,
    };
  }

  protected static dereferenceEntity(
    object: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null | undefined {
    if (typeof object !== 'object' || object === null || object === undefined) {
      return object;
    }

    return Object.fromEntries(
      Object.entries(object).map(([key, value]) => [
        key,
        value instanceof Entity
          ? dereferenceEntityID(value[entityId]) // TODO: Structurally define this somewhere as an utility function!
          : ActionChoice.dereferenceEntity(value as Record<string, unknown>),
      ]),
    );
  }
}
