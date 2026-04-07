import { Action } from './action';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { ChoiceId, dereferenceEntityID } from './choice.types';
import { Entity, entityId } from './entity';
import { NegativeRule } from './rules/negative-rule';

/**
 * A choice is a specific instance of an action that a player can take, including the parameters for that action and a prompt and message to be shown to the player when presenting this choice.
 * This is one of the main objects (besides the raw game state) that is communicated to the player.
 * The player visualizes these choices and can select one of them to execute.
 */
export abstract class Choice<RETURN_TYPE> {
  declare private readonly _returnType: RETURN_TYPE;
}
