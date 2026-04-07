import { Graph } from '../../components/graph/graph';
import { NodeId } from '../../components/graph/node.types';

export class GraphService<NODES extends NodeId = NodeId> {
  constructor(private readonly graph: Graph<NODES>) {}
}
