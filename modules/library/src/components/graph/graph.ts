import { Node } from './node';
import { NodeId } from './node.types';

/**
 * A graph describes the flow of a game through nodes and connections.
 * Each node encapsulates stateless logic and represents the specific step of a game.
 * The graph in its totality describes a game's temporal structure.
 */
export type Graph<NODES extends NodeId | undefined = undefined> = [
  NODES,
] extends [undefined]
  ? { INITIAL: Node<void> }
  : {
      readonly [K in Exclude<NODES, undefined> | 'INITIAL']: K extends 'INITIAL'
        ? Node<Exclude<NODES, undefined>>
        : Node<Exclude<NODES, undefined> | 'INITIAL' | void>;
    };
