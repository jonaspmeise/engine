import { Action } from '../components/action';
import { PlayerInterface } from '../interfaces/player-interface';
import { QueryableRuntime } from './queryable-runtime';

/**
 * @see GraphRuntime models all accessors of the runtime, which should be available to the graph execution.
 */
export interface GraphRuntime extends QueryableRuntime {
  prompt<ACTION extends Action<string, any, any>>(
    player: PlayerInterface,
    choices: ACTION[],
  ): Promise<ACTION>;
  execute(
    action: Action<string, any, any>,
  ): Action<string, any, any> | undefined;
}
