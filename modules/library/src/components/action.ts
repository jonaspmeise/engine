import { ActionParameters } from './action.types';
import { ModifiableRuntime } from '../game/modifiable-runtime';
import { QueryableRuntime } from '../game/queryable-runtime';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { Entity } from './entity';

/**
 * Models a single type of @see Action.
 * This class only describes, how an Action (given its parameters) modifies a game state.
 * An Action does not need to have parameters.
 */
export abstract class Action<
  ACTION_TYPE extends string,
  PARAMETERS extends ActionParameters | undefined = undefined,
  RETURN_TYPE = void,
> {
  public readonly parameters: PARAMETERS;
  private returnInformation: RETURN_TYPE | undefined = undefined;

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
  public async apply(runtime: ModifiableRuntime): Promise<RETURN_TYPE> {
    const result = await this.doApply(runtime);

    this.returnInformation = result;
    return result;
  }

  /**
   * Applies this Action to a game state.
   * This should consume the @see parameters that are passed in the constructor, and modify the game state accordingly.
   * @param runtime The runtime, that allows access to Entities, which are mutable for the context of this Action.
   */
  protected abstract doApply(runtime: ModifiableRuntime): Promise<RETURN_TYPE>;

  /**
   * The name / type of this Action, e.g. "move", "attack" or "mark".
   * This is needed to identify the type of this Action client-side, since due to minification, generating
   * it from the class name might produce non-sensible results.
   */
  public abstract readonly $type: ACTION_TYPE;

  /**
   * Checks if this Action can be applied to a given game state.
   * @param runtime The runtime to check the game state, that allows access to Entities, which are immutable for the context of this check.
   * @param parameters The parameters to check, which are passed in the constructor of this Action.
   * @returns true if this Action can be applied to the given game state, false otherwise.
   */
  public canApply(runtime: QueryableRuntime): boolean {
    return true;
  }

  /**
   * Returns the information that is returned by this Action after it is executed.
   * This can be used to access information about the result of this Action, e.g. how much damage was dealt,
   * which card was drawn, ...
   * @returns The information that is returned by this Action after it is executed.
   * Returns undefined if the action was not executed.
   * Returns null if this Action does not return any information.
   */
  public returned(): RETURN_TYPE | undefined {
    return this.returnInformation;
  }
}
