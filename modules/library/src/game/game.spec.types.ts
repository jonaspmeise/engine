import { Action } from '../components/action';
import { Entity, entityId } from '../components/entity';
import { Game } from './game';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../interfaces/player-interface';
import { QueryableRuntime } from './queryable-runtime';
import { ModifiableRuntime } from './modifiable-runtime';
import { GraphRuntime } from './graph-runtime';
import { Class, EntityClass } from './game.types';
import { NodeId } from '../components/graph/node.types';
import { Graph } from '../components/graph/graph';

export class TestEntityA extends Entity {
  public static readonly $type: string = 'TestEntityA';
  public $type: string = 'TestEntityA';
  constructor(_id: number) {
    super(`testentityA-${_id}`);
  }
  public toString(): string {
    return `TestEntityA`;
  }
}

export class TestEntityB extends Entity {
  public static readonly $type: string = 'TestEntityB';
  public $type: string = 'TestEntityB';
  constructor(id: number | string) {
    super(typeof id === 'number' ? `testentityB-${id}` : id);
  }
  public toString(): string {
    return `TestEntityB`;
  }
}

export class TestEntityC extends TestEntityB {
  public static readonly $type: string = 'TestEntityC';
  public $type: string = 'TestEntityC';
  public volatileNumber: number = 0;

  constructor(_id: number) {
    super(`testentityC-${_id}`);
  }
  public toString(): string {
    return `TestEntityC`;
  }
}

export class TestPlayerEntity extends Entity implements PlayerInterface {
  public static readonly $type: string = 'TestPlayerEntity';
  public $type: string = 'TestPlayerEntity';
  constructor(_id: number) {
    super(`testPlayerEntity-${_id}`);
  }
  [playerInterfaceMarker] = true as const;
  public toString(): string {
    return `TestPlayerEntity`;
  }
}

export class ParameterizedTestAction extends Action<
  'ParameterizedTestAction',
  { value: number }
> {
  public $type: 'ParameterizedTestAction' = 'ParameterizedTestAction';
  constructor(parameters: { value: number }) {
    super(parameters);
  }
  async doApply(runtime: QueryableRuntime): Promise<void> {
    runtime.anyEntity<TestEntityC>(TestEntityC)!.volatileNumber =
      this.parameters.value;
  }
}

export class TestAction extends Action<'TestAction'> {
  public $type: 'TestAction' = 'TestAction';
  async doApply(runtime: QueryableRuntime): Promise<void> {
    runtime.anyEntity<TestEntityC>(TestEntityC)!.volatileNumber++;
  }
}

/**
 * A leaf action that sets the {@link TestEntityC.volatileNumber} of the entity
 * with the given id to a given value. Used as the nested child in the
 * nested-action snapshot tests.
 */
export class SetValueAction extends Action<
  'SetValueAction',
  { id: string; value: number }
> {
  public $type: 'SetValueAction' = 'SetValueAction';
  async doApply(runtime: ModifiableRuntime): Promise<void> {
    const entity = runtime
      .entities(TestEntityC)
      .find((e) => e[entityId] === this.parameters.id)!;
    entity.volatileNumber = this.parameters.value;
  }
}

/**
 * The core repro action for the nested-snapshot-swallow bug.
 *
 * Inside a single `doApply` it:
 *  1. (optionally, when `mutateBefore`) mutates entity `selfId` BEFORE nesting,
 *  2. nested-executes one {@link SetValueAction} per entry in `nest`,
 *  3. (optionally, when `mutateAfter`) mutates entity `selfId` AFTER nesting.
 *
 * The parent's own mutations (steps 1 & 3) must reach the client in a snapshot,
 * ordered relative to the nested children's snapshots.
 */
export class MutateAndNestAction extends Action<
  'MutateAndNestAction',
  {
    selfId: string;
    mutateBefore?: number;
    mutateAfter?: number;
    nest?: { id: string; value: number }[];
  }
> {
  public $type: 'MutateAndNestAction' = 'MutateAndNestAction';
  async doApply(runtime: GraphRuntime): Promise<void> {
    const self = runtime
      .entities(TestEntityC)
      .find((e) => e[entityId] === this.parameters.selfId)!;

    if (this.parameters.mutateBefore !== undefined) {
      self.volatileNumber = this.parameters.mutateBefore;
    }

    for (const nested of this.parameters.nest ?? []) {
      await runtime.execute(new SetValueAction(nested));
    }

    if (this.parameters.mutateAfter !== undefined) {
      self.volatileNumber = this.parameters.mutateAfter;
    }
  }
}

/**
 * Mutates entity `selfId`, then nested-executes a {@link MutateAndNestAction}
 * (which itself mutates-and-nests). Exercises a nested-execute-that-itself-nests.
 */
export class DeepNestAction extends Action<
  'DeepNestAction',
  {
    selfId: string;
    mutateBefore: number;
    child: {
      selfId: string;
      mutateBefore?: number;
      mutateAfter?: number;
      nest?: { id: string; value: number }[];
    };
  }
> {
  public $type: 'DeepNestAction' = 'DeepNestAction';
  async doApply(runtime: GraphRuntime): Promise<void> {
    const self = runtime
      .entities(TestEntityC)
      .find((e) => e[entityId] === this.parameters.selfId)!;
    self.volatileNumber = this.parameters.mutateBefore;

    await runtime.execute(new MutateAndNestAction(this.parameters.child));
  }
}

export class TestGame extends Game {
  public maxDepth: number = 10000;
  public name = 'TestGame';

  initialize() {
    const entities = new Set<Entity>();

    entities.add(new TestEntityA(1));
    entities.add(new TestEntityA(2));
    entities.add(new TestEntityA(3));

    entities.add(new TestEntityB(1));
    entities.add(new TestEntityB(2));

    // TestEntityC also should count as TestEntityB since its a subclass!
    entities.add(new TestEntityC(1));

    entities.add(new TestPlayerEntity(1));
    entities.add(new TestPlayerEntity(2));

    return entities;
  }

  rawGraph(): Graph<NodeId> {
    return {
      INITIAL: async (_runtime) => 'END',
      END: async (_runtime) => undefined,
    };
  }

  entityClasses(): Set<EntityClass<Entity>> {
    return new Set<EntityClass<Entity>>([
      TestEntityA,
      TestEntityB,
      TestEntityC,
      TestPlayerEntity,
    ]);
  }

  actionClasses(): Set<Class<Action<string, any, any>>> {
    return new Set<Class<Action<string, any, any>>>([
      TestAction,
      ParameterizedTestAction,
      SetValueAction,
      MutateAndNestAction,
      DeepNestAction,
    ]);
  }
}
