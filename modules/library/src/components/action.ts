import { ActionParameters } from './action.types';
import { ModifiableRuntime } from '../interfaces/modifiable-runtime';
import { QueryableRuntime } from '../interfaces/queryable-runtime';
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
   * Returns a message describing the effect, after this action is executed.
   * This can be used in the client to show a message to the player after they executed this action.
   * An example would be "You attacked the goblin and dealt 5 damage!".
   * @param player The player for which the message should be generated. This can be used to generate different messages for different players, e.g. the active player gets "You attacked the goblin and dealt 5 damage!", while the opponent gets "The opponent attacked the goblin and dealt 5 damage!".
   */
  public abstract message(player: PlayerEntity): string;

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
  // TODO: Test that an error is thrown if affectedEntities returns an entity that is not registered!
  public abstract affectedEntities(runtime: QueryableRuntime): Entity[] | void;

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
