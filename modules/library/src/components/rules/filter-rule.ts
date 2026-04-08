import { QueryableRuntime } from '../../interfaces/queryable-runtime';
import { Action } from '../action';
import { Choice } from '../choice';
import { NodeId } from '../graph/node.types';
import { Rule } from './rule';

/**
 * A filter rule checks whether a given choice is applicable to the current game state.
 * This can be used to cleanly model denying rules without having to explicitly
 * model that logic in all positive rules.
 **/
export type FilterRule<NODE extends NodeId> = Rule<NODE> & {
  /**
   * Checks whether a given choice is applicable for the current game state.
   * A choice is valid if there is no filter rule preventing its execution.
   * @param choice The choice to check.
   * @param runtime A runtime that allows access to the game state and entities for the context of this check.
   * @returns whether the choice should be denied.
   */
  apply: (
    choice: Choice<Action<string, any>>,
    runtime: QueryableRuntime,
  ) => boolean | void;
};
