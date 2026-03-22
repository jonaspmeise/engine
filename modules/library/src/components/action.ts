import { ActionParameters } from './action.types';
import { GameState } from '../game.types';
import { ModifiableRuntime } from '../interfaces/modifiable-runtime';

/**
 * Models a single type of @see Action.
 * This class only describes, how an Action (given its parameters) modifies a game state.
 * An Action does not need to have parameters.
 */
export abstract class Action<
  STATE extends GameState,
  PARAMETERS extends ActionParameters | undefined = undefined,
> {
  /**
   * TODO: Instead of going over the entire state, we should instead go over entities and modify entities!
   * Applies an @see Action to a game state.
   * @param runtime The runtime, that allows access to Entities, which are mutable for the context of this Action.
   * @param parameters The parameters for this Action, if any exists.
   */
  abstract apply(
    runtime: ModifiableRuntime<STATE>,
    parameters: PARAMETERS extends undefined ? undefined : PARAMETERS,
  ): void;

  // TODO: Message and Prompt!

  // TODO: A method that given the state and the parameters, returns a list of all entities that are affected by this action.
  // The client can then use this information to highlight those entities in their UI.
}
