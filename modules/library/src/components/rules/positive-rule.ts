import { QueryableRuntime } from '../../interfaces/queryable-runtime';
import { Action } from '../action';
import { Choice } from '../choice';
import { NodeId } from '../graph/node.types';
import { Rule } from './rule';

/**
 * A positive rule models a rule that adds choices to the choice space of a player.
 * Every game needs at least one positive rule, otherwise no choice is ever generated.
 * It can be used to model rules that grant players additional choices, for example by granting them new actions or by triggering additional rules.
 */
export type GeneratorRule<NODE extends NodeId = NodeId> = Rule<NODE> & {
  /**
   * Generates choices for all/any players in the given runtime context.
   * Note that some of these choices may later be filtered by @see NegativeRule.
   * @param runtime A reference for the runtime, which allows access to entities.
   * @returns The choices to add to the choice space of the given player.
   * If no choices should be added, this can also not return anything.
   */
  apply: (runtime: QueryableRuntime) => Choice<Action<string, any>>[] | void;
};
