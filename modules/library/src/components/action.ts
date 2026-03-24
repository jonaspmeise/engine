import { ActionParameters } from './action.types';
import { ModifiableRuntime } from '../interfaces/modifiable-runtime';

/**
 * Models a single type of @see Action.
 * This class only describes, how an Action (given its parameters) modifies a game state.
 * An Action does not need to have parameters.
 */
export abstract class Action<
  PARAMETERS extends ActionParameters | undefined = undefined,
> {
  // TODO: If parameters is undefined, this should be optional in the constructor and apply method.
  public readonly parameters: PARAMETERS;

  constructor();
  constructor(parameters: PARAMETERS);
  constructor(parameters?: PARAMETERS) {
    this.parameters = parameters as PARAMETERS;
  }

  /**
   * Applies this Action to a game state.
   * This should consume the @see parameters that are passed in the constructor, and modify the game state accordingly.
   * @param runtime The runtime, that allows access to Entities, which are mutable for the context of this Action.
   */
  abstract apply(runtime: ModifiableRuntime): void;

  public abstract readonly name: string;

  // TODO: Message and Prompt!

  // TODO: A method that given the state and the parameters, returns a list of all entities that are affected by this action.
  // The client can then use this information to highlight those entities in their UI.
}
