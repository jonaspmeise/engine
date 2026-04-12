import { ComplexGraph, Graph } from '../../components/graph/graph';
import { NodeId } from '../../components/graph/node.types';
import { DEFAULT_LOGGER, Logger } from '../../game/game.types';
import { ModifiableRuntime } from '../../game/modifiable-runtime';

export class GraphService<NODES extends NodeId> {
  private readonly _graph: ComplexGraph<Graph<NODES>>;

  constructor(
    _graph: Graph<NODES>,
    private readonly _logger: Logger = DEFAULT_LOGGER,
  ) {
    this._graph = {
      current: 'INITIAL',
      ended: false,
      nodes: Object.fromEntries(
        Object.entries(_graph).map(([key, node]) => [
          key,
          {
            name: key,
            calls: 0,
            execute: node,
          },
        ]),
      ) as ComplexGraph<Graph<NODES>>['nodes'],
    };
  }

  public graph(): ComplexGraph<Graph<NODES>> {
    return this._graph;
  }

  public isEnded(): boolean {
    return this._graph.ended;
  }

  public isSetup(): boolean {
    return (
      this._graph.current === 'INITIAL' &&
      this._graph.nodes['INITIAL'].calls === 0
    );
  }

  /**
   * Executes the code of the current node and moves internally to the next node.
   */
  public async execute(runtime: ModifiableRuntime): Promise<void> {
    this._logger.debug(`Executing node: ${this._graph.current}`);

    if (this._graph.current === undefined) {
      return;
    }
    const current = this._graph.nodes[this._graph.current]!;
    current.calls += 1;

    const next = await current.execute(runtime);

    this._graph.current = next ?? undefined;
    this._graph.ended = this._graph.current === undefined;

    this._logger.debug(
      `Finished executing node. Next node: ${this._graph.current}. Graph ended: ${this._graph.ended}`,
    );
  }
}
