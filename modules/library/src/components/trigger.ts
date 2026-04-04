import { ModifiableRuntime } from '../interfaces/modifiable-runtime';
import { Action } from './action';
import { Choice } from './choice';
import { Executable } from './choice.types';

/**
 * A trigger is a component that after an action is done, checks whether it should be executed
 * based on the current game state.
 */
// TODO: All components should just be interfaces, and there should be abstract classes "Base___" for each component.
export interface Trigger {
  // The name of the trigger.
  readonly name: string;

  /**
   * Checks whether this trigger should be executed based on the current game state.
   * @param state The current state of the game.
   * @param lastChoice The last choice that was executed, if any.
   * @returns A list of choices or executables to execute if the trigger is executed, or void if the trigger should not be executed.
   */
  // TODO: IMPORTANT: We might also just directly call actions, which are debounced by the engine, instead of us having to debounce them...?
  // TODO: Otherwise developers might get confused about what exactly the structure of this trigger / return type is.
  apply(
    state: ModifiableRuntime,
    lastChoice: Choice<Action<string, any>> | undefined,
  ): TriggerReturnType[] | void;
}

export type TriggerReturnType = Choice<Action<string, any>> | Executable;
