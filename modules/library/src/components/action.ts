import { ActionParameters } from './action.types';
import { ModifiableRuntime } from '../interfaces/modifiable-runtime';
import { EntityID } from './entity.types';
import { QueryableRuntime } from '../interfaces/queryable-runtime';

/**
 * Models a single type of @see Action.
 * This class only describes, how an Action (given its parameters) modifies a game state.
 * An Action does not need to have parameters.
 */
export abstract class Action<
  TYPE extends string = string,
  PARAMETERS extends ActionParameters | undefined = undefined,
> {
  public readonly parameters: PARAMETERS;

  constructor(
    ...args: PARAMETERS extends undefined ? [] : [parameters: PARAMETERS]
  ) {
    this.parameters = args[0] as PARAMETERS;
  }

  /**
   * Applies this Action to a game state.
   * This should consume the @see parameters that are passed in the constructor, and modify the game state accordingly.
   * @param runtime The runtime, that allows access to Entities, which are mutable for the context of this Action.
   */
  abstract apply(runtime: ModifiableRuntime): void;

  /**
   * The name / type of this Action, e.g. "move", "attack" or "mark".
   * This is needed to identify the type of this Action client-side, since due to minification, generating
   * it from the class name might produce non-sensible results.
   */
  public abstract readonly $type: TYPE;

  /**
   * Returns a message describing the effect, after this action is executed.
   * This can be used in the client to show a message to the player after they executed this action.
   * An example would be "You attacked the goblin and dealt 5 damage!".
   */
  public abstract message(): string;

  /**
   * Returns a prompt describing this action, which can be used to present this action as a choice to the player.
   * This can be used in the client to show a message to the player when presenting this action as a choice.
   * An example would be "Attack the goblin with your sword.".
   */
  public abstract prompt(): string;

  /**
   * Returns a list of all entities that are affected by this action.
   * This can be used by the client to highlight these entities accordingly.
   * All entities should exist.
   * @param runtime The runtime, that allows access to Entities outside of the internal state of this Choice.
   * @returns A list of all entities that are affected by this action, or alternatively void if none are affected (which should rarely be the case!).
   */
  public abstract affectedEntities(
    runtime: QueryableRuntime,
  ): EntityID[] | void;
}
