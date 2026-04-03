import { Action } from './components/action';
import { Choice } from './components/choice';
import { Entity } from './components/entity';
import { PositiveRule } from './components/positive-rule';
import { Trigger } from './components/trigger';
import { Game } from './game';
import { EntityClass } from './game.types';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from './interfaces/player-interface';
import { QueryableRuntime } from './interfaces/queryable-runtime';

export class TestEntityA extends Entity {
  public $type: string = 'TestEntityA';
  constructor(_id: number) {
    super(`testentityA-${_id}`);
  }
}

export class TestEntityB extends Entity {
  public $type: string = 'TestEntityB';
  constructor(id: number | string) {
    super(typeof id === 'number' ? `testentityB-${id}` : id);
  }
}

export class TestEntityC extends TestEntityB {
  public $type: string = 'TestEntityC';
  public volatileNumber: number = 0;

  constructor(_id: number) {
    super(`testentityC-${_id}`);
  }
}

export class TestPlayerEntity extends Entity implements PlayerInterface {
  public $type: string = 'TestPlayerEntity';
  constructor(_id: number) {
    super(`testPlayerEntity-${_id}`);
  }
  [playerInterfaceMarker] = true as const;
}

export class TestAction extends Action {
  public message(): string {
    return 'TestAction executed!';
  }
  public prompt(): string {
    return 'Execute TestAction';
  }
  public affectedEntities() {}
  public $type = 'TestAction';
  apply(_runtime: QueryableRuntime): void {
    _runtime.anyEntity<TestEntityC>(TestEntityC)!.volatileNumber++;
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

  entityClasses(): Set<EntityClass<Entity>> {
    return new Set<EntityClass<Entity>>([
      TestEntityA,
      TestEntityB,
      TestEntityC,
      TestPlayerEntity,
    ]);
  }

  positiveRules(): Set<PositiveRule> {
    return new Set<PositiveRule>([
      {
        name: 'test-positive-rule',
        apply: (runtime) =>
          runtime
            .entities(TestPlayerEntity)
            .map((player) => new Choice(new TestAction(), player)),
      },
    ]);
  }
  negativeRules(): void {}
  triggers(): Set<Trigger> | void {}
}
