import { Action } from './action';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { ChoiceId, dereferenceEntityID } from './choice.types';
import { Entity, entityId } from './entity';
import { FilterRule } from './rules/filter-rule';
import { NodeId } from './graph/node.types';

/**
 * A choice is a specific instance of an action that a player can take, including the parameters for that action and a prompt and message to be shown to the player when presenting this choice.
 * This is one of the main objects (besides the raw game state) that is communicated to the player.
 * The player visualizes these choices and can select one of them to execute.
 */
export class Choice<ACTION extends Action<string, any>> {
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
    public readonly preventedBy: FilterRule<NodeId> | undefined = undefined,
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
          : EnhancedChoice.dereferenceEntity(value as Record<string, unknown>),
      ]),
    );
  }
}

/**
 * This enhanced version of the Choice class is issued by the engine and communicated to the player.
 */
export class EnhancedChoice<
  ACTION extends Action<string, any>,
> extends Choice<ACTION> {
  constructor(
    public readonly id: ChoiceId,
    execution: ACTION,
    player: PlayerEntity,
    preventedBy: FilterRule<NodeId> | undefined = undefined,
  ) {
    super(execution, player, preventedBy);
  }

  toJSON(): Record<any, unknown> {
    return {
      ...super.toJSON(),
      id: this.id,
    };
  }

  static fromChoice<ACTION extends Action<string, any>>(
    choice: Choice<ACTION>,
    id: ChoiceId,
  ): EnhancedChoice<ACTION> {
    return new EnhancedChoice(
      id,
      choice.execution,
      choice.player,
      choice.preventedBy,
    );
  }
}
