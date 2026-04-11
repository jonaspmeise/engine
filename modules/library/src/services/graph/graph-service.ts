import { Graph } from '../../components/graph/graph';
import { Node } from '../../components/graph/node';
import { NodeId } from '../../components/graph/node.types';

export class GraphService<NODES extends NodeId = NodeId> {
  private _currentNode: Node | undefined = undefined;

  constructor(private readonly graph: Graph<NODES>) {}
}
