import { Action } from './action';
import { ActionParameters } from './action.types';
import { Class } from '../game.types';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { ChoiceId } from './choice.types';

/**
 * A choice is a specific instance of an action that a player can take, including the parameters for that action and a prompt and message to be shown to the player when presenting this choice.
 * This is one of the main objects (besides the raw game state) that is communicated to the player.
 * The player visualizes these choices and can select one of them to execute.
 */
export class Choice<
  ACTION extends Action<PARAMETERS>,
  PARAMETERS extends ActionParameters | undefined = undefined,
> {
  constructor(
    public readonly action: Class<ACTION>,
    public readonly parameters: PARAMETERS extends undefined
      ? undefined
      : PARAMETERS,
    public readonly player: PlayerEntity,
  ) {}
}

/**
 * This enhanced version of the Choice class is issued by the engine and communicated to the player.
 */
export class EnhancedChoice<
  ACTION extends Action<PARAMETERS>,
  PARAMETERS extends ActionParameters | undefined = undefined,
> extends Choice<ACTION, PARAMETERS> {
  constructor(
    public readonly id: ChoiceId,
    action: Class<ACTION>,
    parameters: PARAMETERS extends undefined ? undefined : PARAMETERS,
    player: PlayerEntity,
  ) {
    super(action, parameters, player);
  }

  static fromChoice<
    ACTION extends Action<PARAMETERS>,
    PARAMETERS extends ActionParameters | undefined = undefined,
  >(
    choice: Choice<ACTION, PARAMETERS>,
    id: ChoiceId,
  ): EnhancedChoice<ACTION, PARAMETERS> {
    return new EnhancedChoice(
      id,
      choice.action,
      choice.parameters,
      choice.player,
    );
  }
}
