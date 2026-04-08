import { NodeId } from '../graph/node.types';

/**
 * The base class of both generator and filter rules.
 * Every rule has a name and is applicable to a specific set of nodes.
 * If a rule is applicable to a node, it will be executed and evaluated when that node is executed in the graph.
 *
 * @param name The name of the rule, which should be unique within a game.
 * @param applicableTo The nodes to which this rule is applicable. If empty, the rule is applicable to all nodes.
 */
export type Rule<NODE extends NodeId> = {
  name: string;
  applicableTo?: ReadonlyArray<NODE> | undefined;
};
