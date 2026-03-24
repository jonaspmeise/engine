import { Action } from './action';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { ChoiceId } from './choice.types';

/**
 * A choice is a specific instance of an action that a player can take, including the parameters for that action and a prompt and message to be shown to the player when presenting this choice.
 * This is one of the main objects (besides the raw game state) that is communicated to the player.
 * The player visualizes these choices and can select one of them to execute.
 */
export class Choice<ACTION extends Action<any>> {
  /**
   * Instantiate a choice.
   * @param execution The action that will be executed when the player selects this choice, including the parameters for that action.
   * Since the object is instantiated, the action and parameters are bound here.
   * @param player The player to who this choice belongs.
   */
  constructor(
    public readonly execution: ACTION,
    public readonly player: PlayerEntity,
  ) {}
}

/**
 * This enhanced version of the Choice class is issued by the engine and communicated to the player.
 */
export class EnhancedChoice<ACTION extends Action<any>> extends Choice<ACTION> {
  constructor(
    public readonly id: ChoiceId,
    execution: ACTION,
    player: PlayerEntity,
  ) {
    super(execution, player);
  }

  static fromChoice<ACTION extends Action<any>>(
    choice: Choice<ACTION>,
    id: ChoiceId,
  ): EnhancedChoice<ACTION> {
    return new EnhancedChoice(id, choice.execution, choice.player);
  }
}
