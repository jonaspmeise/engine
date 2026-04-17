import { ComplexGraph, Graph } from '../../components/graph/graph';
import { NodeId } from '../../components/graph/node.types';
import { DEFAULT_LOGGER, Logger } from '../../game/game.types';
import { ModifiableRuntime } from '../../game/modifiable-runtime';

export class GraphService<NODES extends NodeId> {
  private readonly rawGraph: ComplexGraph<Graph<NODES>>;

  constructor(
    rawGraph: Graph<NODES>,
    private readonly _logger: Logger = DEFAULT_LOGGER,
  ) {
    this.rawGraph = {
      current: 'INITIAL',
      ended: false,
      nodes: Object.fromEntries(
        Object.entries(rawGraph).map(([key, node]) => [
          key,
          {
            name: key,
            calls: 0,
            execute: node,
          },
        ]),
      ) as ComplexGraph<Graph<NODES>>['nodes'],
    };

    this._logger.debug(
      `Graph has the following nodes: ${Object.keys(this.rawGraph.nodes).join(', ')}`,
    );
  }

  public graph(): ComplexGraph<Graph<NODES>> {
    return this.rawGraph;
  }

  public isEnded(): boolean {
    return this.rawGraph.ended;
  }

  public isSetup(): boolean {
    return (
      this.rawGraph.current === 'INITIAL' &&
      this.rawGraph.nodes['INITIAL'].calls === 0
    );
  }

  /**
   * Executes the code of the current node and moves internally to the next node.
   * @returns whether there is a next node, or not.
   */
  public async execute(runtime: ModifiableRuntime): Promise<boolean> {
    this._logger.debug(`Executing node: ${this.rawGraph.current}`);

    if (this.rawGraph.current === undefined) {
      return false;
    }
    const current = this.rawGraph.nodes[this.rawGraph.current]!;
    current.calls += 1;

    const next = await current.execute(runtime);

    this.rawGraph.current = next ?? undefined;
    this.rawGraph.ended = this.rawGraph.current === undefined;

    this._logger.debug(
      `Finished executing node. Next node: ${this.rawGraph.current}. Graph ended: ${this.rawGraph.ended}`,
    );

    return !this.rawGraph.ended;
  }
}
