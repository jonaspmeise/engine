import {
  jest,
  describe,
  afterEach,
  beforeEach,
  mock,
  expect,
  test,
} from 'bun:test';
import { Logger, NO_OP_LOGGER } from '../../game/game.types';
import { GraphService } from './graph-service';
import { Graph } from '../../components/graph/graph';
import { ModifiableRuntime } from '../../game/modifiable-runtime';

type dummyNodes = 'NodeA' | 'NodeB' | 'NodeC';
const dummyGraph: Graph<dummyNodes> = {
  INITIAL: () => {
    return 'NodeA';
  },
  NodeA: () => {
    return 'NodeB';
  },
  NodeB: () => {
    return 'NodeC';
  },
  NodeC: () => {},
};

describe('GraphService', () => {
  let service: GraphService<dummyNodes>;

  const logger: Logger = {
    log: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  };

  const runtime: ModifiableRuntime = {} as ModifiableRuntime;

  beforeEach(() => {
    service = new GraphService<dummyNodes>(dummyGraph, NO_OP_LOGGER);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('graph', () => {
    test('returns the correct initial state', () => {
      // GIVEN / WHEN
      const graph = service.graph();

      expect(service.isEnded()).toBe(false);
      expect(service.isSetup()).toBe(true);
      expect(graph.current).toBe('INITIAL');
      expect(service.graph().ended).toBe(false);
      expect(Object.keys(graph.nodes)).toEqual(
        expect.arrayContaining(['NodeA', 'NodeB', 'NodeC']),
      );
      expect(graph.nodes.INITIAL.calls).toBe(0);
      expect(graph.nodes.NodeA.calls).toBe(0);
      expect(graph.nodes.NodeB.calls).toBe(0);
      expect(graph.nodes.NodeC.calls).toBe(0);
    });
  });

  describe('execute', () => {
    test('executes the next step of the graph', async () => {
      // GIVEN / WHEN
      const hasNext = await service.execute(runtime);

      // THEN
      expect(hasNext).toBe(true);
      expect(service.graph().current).toBe('NodeA');
      expect(service.graph().ended).toBe(false);
      expect(service.graph().nodes.INITIAL.calls).toBe(1);
      expect(service.graph().nodes.NodeA.calls).toBe(0);
      expect(service.graph().nodes.NodeB.calls).toBe(0);
      expect(service.graph().nodes.NodeC.calls).toBe(0);
      expect(service.isEnded()).toBe(false);
      expect(service.isSetup()).toBe(false);
    });

    test('does not do anything if the graph has ended.', async () => {
      // GIVEN
      const service = new GraphService(
        {
          INITIAL: () => {},
        },
        logger,
      );

      // WHEN
      const hasNext1 = await service.execute(runtime);
      const hasNext2 = await service.execute(runtime);

      expect(hasNext1).toBe(false);
      expect(hasNext2).toBe(false);

      // THEN
      expect(service.graph().current).toBe(undefined);
      expect(service.graph().ended).toBe(true);
      expect(service.graph().nodes.INITIAL.calls).toBe(1);
      expect(service.isEnded()).toBe(true);
      expect(service.isSetup()).toBe(false);
    });
  });

  describe('clone', () => {
    test('the cloned service has the same initial state as the original.', () => {
      // GIVEN / WHEN
      const clone = service.clone();

      // THEN
      expect(clone.graph().current).toBe('INITIAL');
      expect(clone.graph().ended).toBe(false);
      expect(clone.isSetup()).toBe(true);
      expect(clone.isEnded()).toBe(false);
      expect(clone.graph().nodes.INITIAL.calls).toBe(0);
      expect(clone.graph().nodes.NodeA.calls).toBe(0);
    });

    test('the cloned service reflects the current node after some executions.', async () => {
      // GIVEN
      await service.execute(runtime); // INITIAL -> NodeA
      await service.execute(runtime); // NodeA -> NodeB

      // WHEN
      const clone = service.clone();

      // THEN
      expect(clone.graph().current).toBe('NodeB');
      expect(clone.graph().ended).toBe(false);
      expect(clone.isSetup()).toBe(false);
      expect(clone.graph().nodes.INITIAL.calls).toBe(1);
      expect(clone.graph().nodes.NodeA.calls).toBe(1);
      expect(clone.graph().nodes.NodeB.calls).toBe(0);
      expect(service.graph().current).toBe('NodeB');
      expect(service.graph().ended).toBe(false);
      expect(service.isSetup()).toBe(false);
      expect(service.graph().nodes.INITIAL.calls).toBe(1);
      expect(service.graph().nodes.NodeA.calls).toBe(1);
      expect(service.graph().nodes.NodeB.calls).toBe(0);
    });

    test('the cloned service reflects the ended state when the original has ended.', async () => {
      // GIVEN
      const service = new GraphService({ INITIAL: () => {} }, NO_OP_LOGGER);
      await service.execute(runtime);

      // WHEN
      const clone = service.clone();

      // THEN
      expect(clone.isEnded()).toBe(true);
      expect(clone.graph().ended).toBe(true);
      expect(clone.graph().current).toBe(undefined);
      expect(clone.graph().nodes.INITIAL.calls).toBe(1);
      expect(service.isEnded()).toBe(true);
      expect(service.graph().ended).toBe(true);
      expect(service.graph().current).toBe(undefined);
      expect(service.graph().nodes.INITIAL.calls).toBe(1);
    });

    test('executing the clone does not affect the original.', async () => {
      // GIVEN
      await service.execute(runtime); // INITIAL -> NodeA
      const clone = service.clone();

      // WHEN
      await clone.execute(runtime); // NodeA -> NodeB

      // THEN
      expect(service.graph().current).toBe('NodeA');
      expect(clone.graph().current).toBe('NodeB');
    });

    test('executing the original does not affect the clone.', async () => {
      // GIVEN
      await service.execute(runtime); // INITIAL -> NodeA
      const clone = service.clone();

      // WHEN
      await service.execute(runtime); // NodeA -> NodeB

      // THEN
      expect(clone.graph().current).toBe('NodeA');
      expect(service.graph().current).toBe('NodeB');
    });
  });
});
