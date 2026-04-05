import { ModifiableRuntime } from '../interfaces/modifiable-runtime';
import { NodeId } from './node.types';

/**
 * Describes a node in the graph, which encapsulates stateless logic that transform game state, queries players etc.
 * @returns The id of the next node to execute.
 * If void is returned, the graph execution will stop. This should only be used for terminal nodes, e.g. end game nodes.
 * // TODO: Test that throws an error if node is terminal but the game is not ended yet!
 */
export type Node = (
  runtime: ModifiableRuntime,
) => Promise<NodeId> | NodeId | void;
