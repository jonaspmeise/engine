import { QueryableRuntime } from '../interfaces/queryable-runtime';
import { Action } from './action';
import { Choice } from './choice';
import { Executable } from './choice.types';

/**
 * A trigger is a component that after an action is done, checks whether it should be executed
 * based on the current game state.
 */
// TODO: Should this be a class or just a type? Since triggers (might) have internal state, maybe its better as a class...
export abstract class Trigger {
  /**
   * Checks whether this trigger should be executed based on the current game state.
   * @param state The current state of the game.
   * @param lastChoice The last choice that was executed, if any.
   * @returns A list of choices or executables to execute if the trigger is executed, or void if the trigger should not be executed.
   */
  abstract apply(
    state: QueryableRuntime,
    lastChoice: Choice<Action<any>> | undefined,
  ): TriggerReturnType[] | void;
}

export type TriggerReturnType = Choice<Action<any>> | Executable;
