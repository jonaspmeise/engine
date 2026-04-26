import { Action } from '../components/action';
import { PlayerInterface } from '../interfaces/player-interface';
import { QueryableRuntime } from './queryable-runtime';

/**
 * @see GraphRuntime models all accessors of the runtime, which should be available to the graph execution.
 */
export interface GraphRuntime extends QueryableRuntime {
  /**
   * Prompts a player with a set of choices, and waits for the player to make a choice.
   * @param player The player to prompt.
   * @param choices The set of choices to present to the player.
   * @returns A promise that resolves to the chosen action.
   */
  prompt<ACTION extends Action<string, any, any>>(
    player: PlayerInterface,
    choices: ACTION[],
  ): Promise<ACTION>;
  /**
   * Executes an action in the game.
   * This is the only way to modify the game state!
   * @param action The action to execute.
   * @returns A promise that resolves, when the action has been executed.
   * The promise resolves to the executed action, if it was fully executed.
   * This may not be the same object as the passed in action,
   * since some properties (or even its complete type!) may be modified during execution due to triggers.
   * The promise resolves to undefined, if the action was prevented, e.g. due to a "check"-hook.
   */
  execute(
    action: Action<string, any, any>,
  ): Promise<Action<string, any, any> | undefined>;
}
