import { describe, test, expect, mock, spyOn, jest } from 'bun:test';
import { SnapshotService } from './snapshot-service';
import { Action } from '../../components/action';
import { PositiveRule } from '../../components/positive-rule';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../../interfaces/player-interface';
import { QueryableRuntime } from '../../interfaces/queryable-runtime';
import { Choice } from '../../components/choice';
import { ModifiableRuntime } from '../../interfaces/modifiable-runtime';
import { EntityID } from '../../components/entity.types';
import { Entity } from '../../components/entity';
import { beforeEach } from 'node:test';

type TestState = {
  value: number;
};

class TestEntity extends Entity<TestState> {
  public value: number = 0;

  persist(state: TestState): void {
    state.value = this.value;
  }
  protected generateId(): EntityID {
    return `TestEntity-${this._id}`;
  }
  constructor(protected readonly _id: number) {
    super();
  }
}

class TestActionA extends Action<TestState> {
  apply(runtime: ModifiableRuntime<TestState>): void {
    runtime.anyEntity<TestEntity>(TestEntity)!.value++;
  }

  constructor() {
    super();
  }
}

class TestPlayer
  extends Entity<TestState>
  implements PlayerInterface<TestState>
{
  persist(_state: TestState, _runtime: QueryableRuntime<TestState>): void {
    // Player state is not changed during runtime!
  }
  protected generateId(): EntityID {
    return `TestPlayer`;
  }

  [playerInterfaceMarker] = true as const;
}

describe('snapshotService', () => {
  const mockRuntime: QueryableRuntime<TestState> = {
    anyEntity: mock(() => null),
    entities: mock(() => []),
    entitySet: mock(() => new Set()),
  } as QueryableRuntime<TestState>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('throws an error if no actions are provided. A game without actions is not possible.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new SnapshotService({
            actions: new Set(),
            positiveRules: new Set() as Set<PositiveRule<TestState>>,
          }),
      ).toThrowError(/no actions/gi);
    });

    test('throws an error if no positive rules are provided. A game without positive rules is not possible.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new SnapshotService({
            actions: new Set([TestActionA]),
            positiveRules: new Set() as Set<PositiveRule<TestState>>,
          }),
      ).toThrowError(/no positive rules/gi);
    });
  });

  describe('calculateChoices', () => {
    test('returns the correct choice space given only positive rules.', () => {
      // GIVEN
      const service = new SnapshotService({
        actions: new Set([new TestActionA()]),
        positiveRules: new Set([
          (runtime: QueryableRuntime<TestState>) => [
            new Choice(
              TestActionA,
              undefined,
              runtime.anyEntity<TestPlayer>(TestPlayer)!,
            ),
          ],
        ]),
      });

      const player = new TestPlayer();

      spyOn(mockRuntime, 'anyEntity').mockReturnValue(player);
      // WHEN
      const choices = service.calculateChoices(mockRuntime);

      // THEN
      expect(choices).toHaveLength(1);
      expect(choices).toEqual(
        new Set([new Choice(TestActionA, undefined, player)]),
      );
    });

    test('if choices for a player, which is not registered in the runtime, are generated, an error is thrown.', () => {});
  });
});
