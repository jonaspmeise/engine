import { PlayerInterface } from '../interfaces/player-interface';
import { Action } from './action';
import { ActionParameters } from './action.types';
import { Class } from '../game.types';
import { PlayerEntity } from '../services/entity/entity-service.types';

/**
 * A choice is a specific instance of an action that a player can take, including the parameters for that action and a prompt and message to be shown to the player when presenting this choice.
 * This is one of the main objects (besides the raw game state) that is communicated to the player.
 * The player visualizes these choices and can select one of them to execute.
 */
export class Choice<
  ACTION extends Action<any, PARAMETERS>,
  PARAMETERS extends ActionParameters | undefined = undefined,
> {
  constructor(
    public readonly action: Class<ACTION>,
    public readonly parameters: PARAMETERS extends undefined
      ? undefined
      : PARAMETERS,
    public readonly player: PlayerEntity<any>,
  ) {}
}
