import { Node } from './node';
import { NodeId } from './node.types';

/**
 * A graph describes the flow of a game through nodes and connections.
 * Each node encapsulates stateless logic and represents the specific step of a game.
 * The graph in its totality describes a game's temporal structure.
 */
export type Graph<NODES extends NodeId = never> = {
  readonly INITIAL: Node<NODES | void>;
} & {
  readonly [K in NODES]: Node<NODES | void>;
};

/**
 * A complex graph additionally tracks additional metadata:
 */
export type ComplexGraph<GRAPH extends { INITIAL: unknown }> = {
  current: keyof GRAPH | undefined;
  ended: boolean;
  nodes: {
    [K in keyof GRAPH]: ComplexNode<GRAPH[K] & Node>;
  };
};

/**
 * A complex node tracks additional metadata per node:
 * - name of the graph
 * - number of calls
 * - the execution function
 */
export type ComplexNode<NODE extends Node> = {
  name: string;
  calls: number;
  execute: NODE;
};
