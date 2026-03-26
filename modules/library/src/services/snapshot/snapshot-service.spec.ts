import { describe, test, expect, mock, spyOn, jest } from 'bun:test';
import { SnapshotService } from './snapshot-service';
import { Action } from '../../components/action';
import { PositiveRule } from '../../components/positive-rule';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../../interfaces/player-interface';
import { QueryableRuntime } from '../../interfaces/queryable-runtime';
import { Choice, EnhancedChoice } from '../../components/choice';
import { ModifiableRuntime } from '../../interfaces/modifiable-runtime';
import { Entity } from '../../components/entity';
import { beforeEach } from 'node:test';
import { EntityID } from '../../components/entity.types';

class TestEntity extends Entity {
  public $type: string = 'TestEntity';
  public value: number = 0;

  constructor(readonly _id: number) {
    super(`TestEntity-${_id}`);
  }
}

class TestActionA extends Action<{ shouldBePrevented: boolean } | undefined> {
  public message(): string {
    return 'TestActionA executed!';
  }
  public prompt(): string {
    return 'Execute TestActionA';
  }
  public affectedEntities(runtime: QueryableRuntime): EntityID[] | void {
    return [runtime.anyEntity<TestEntity>(TestEntity)!.$id];
  }
  apply(runtime: ModifiableRuntime): void {
    runtime.anyEntity<TestEntity>(TestEntity)!.value++;
  }

  public $type: string = 'TestActionA';
}

class TestPlayer extends Entity implements PlayerInterface {
  public $type: string = 'TestPlayer';

  constructor() {
    super(`player-${Math.random()}`);
  }

  [playerInterfaceMarker] = true as const;
}

describe('snapshotService', () => {
  const mockRuntime: QueryableRuntime = {
    anyEntity: mock(() => null),
    entities: mock(() => []),
    entitySet: mock(() => new Set()),
    history: mock(() => []),
  } as QueryableRuntime;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('throws an error if no positive rules are provided. A game without positive rules is not possible.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new SnapshotService({
            positiveRules: new Set() as Set<PositiveRule>,
          }),
      ).toThrowError(/no positive rules/gi);
    });

    test('throws an error if any positive rules have duplicate names.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new SnapshotService({
            positiveRules: new Set([
              {
                name: 'TestPositiveRule',
                apply: () => [],
              },
              {
                name: 'TestPositiveRule',
                apply: () => [],
              },
            ]),
          }),
      ).toThrowError(/duplicate/gi);
    });

    test('throws an error if any negative rules have duplicate names.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new SnapshotService({
            positiveRules: new Set([
              {
                name: 'TestPositiveRule',
                apply: () => [],
              },
            ]),
            negativeRules: new Set([
              {
                name: 'TestNegativeRule',
                apply: () => false,
              },
              {
                name: 'TestNegativeRule',
                apply: () => false,
              },
            ]),
          }),
      ).toThrowError(/duplicate/gi);
    });

    test('throws an error if any positive or negative rules have duplicate names.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new SnapshotService({
            positiveRules: new Set([
              {
                name: 'TestRule',
                apply: () => [],
              },
            ]),
            negativeRules: new Set([
              {
                name: 'TestRule',
                apply: () => false,
              },
            ]),
          }),
      ).toThrowError(/duplicate/gi);
    });
  });

  describe('calculateChoices', () => {
    test('returns the correct choice space given only positive rules.', () => {
      // GIVEN
      const service = new SnapshotService({
        positiveRules: new Set([
          {
            name: 'TestPositiveRule',
            apply: (runtime: QueryableRuntime) => [
              new Choice(
                new TestActionA({
                  shouldBePrevented: false,
                }),
                runtime.anyEntity<TestPlayer>(TestPlayer)!,
              ),
            ],
          },
        ]),
      });

      const player = new TestPlayer();

      // Player should be registered by the runtime!
      spyOn(mockRuntime, 'anyEntity').mockReturnValue(player);
      spyOn(mockRuntime, 'entitySet').mockReturnValue(new Set([player]));

      // WHEN
      const choices = service.calculateChoices(mockRuntime);

      // THEN
      expect(choices).toHaveLength(1);
      expect(choices).toEqual(
        new Set([
          new EnhancedChoice(
            'choice-0',
            new TestActionA({
              shouldBePrevented: false,
            }),
            player,
          ),
        ]),
      );
    });

    test('if choices for a player, which is not registered in the runtime, are generated, an error is thrown.', () => {
      // GIVEN
      const service = new SnapshotService({
        positiveRules: new Set([
          {
            name: 'TestPositiveRule',
            apply: (_runtime: QueryableRuntime) => [
              new Choice(
                new TestActionA({
                  shouldBePrevented: false,
                }),
                new TestPlayer(), // This player is not registered in the runtime, thus an error should be thrown.
              ),
            ],
          },
        ]),
      });

      // WHEN / THEN
      expect(() => service.calculateChoices(mockRuntime)).toThrowError(
        /player/i,
      );
    });

    test('negative rules prevent choices from being generated.', () => {
      // GIVEN
      const service = new SnapshotService({
        positiveRules: new Set([
          {
            name: 'TestPositiveRule',
            apply: (runtime: QueryableRuntime) => [
              new Choice(
                new TestActionA({
                  shouldBePrevented: true,
                }),
                runtime.anyEntity<TestPlayer>(TestPlayer)!,
              ),
              new Choice(
                new TestActionA({
                  shouldBePrevented: false,
                }),
                runtime.anyEntity<TestPlayer>(TestPlayer)!,
              ),
            ],
          },
        ]),
        negativeRules: new Set([
          {
            name: 'TestNegativeRule',
            apply: (choice: Choice<TestActionA>, _runtime: QueryableRuntime) =>
              (choice as Choice<TestActionA>).execution.parameters
                ?.shouldBePrevented ?? false,
          },
        ]),
      });

      // Player should be registered by the runtime!
      const player = new TestPlayer();
      spyOn(mockRuntime, 'anyEntity').mockReturnValue(player);
      spyOn(mockRuntime, 'entitySet').mockReturnValue(new Set([player]));

      // WHEN
      const choices = service.calculateChoices(mockRuntime);

      // THEN
      expect(choices).toHaveLength(1);
      expect(choices).toEqual(
        new Set([
          new EnhancedChoice(
            'choice-1', // The first choice is completely filtered out...
            new TestActionA({
              shouldBePrevented: false,
            }),
            player,
          ),
        ]),
      );
    });

    test('throws an error if no player has any choices in a snapshot.', () => {
      // GIVEN
      const service = new SnapshotService({
        positiveRules: new Set([
          {
            name: 'TestPositiveRule',
            apply: (_runtime: QueryableRuntime) => [],
          },
        ]),
      });

      // WHEN / THEN
      expect(() => service.calculateChoices(mockRuntime)).toThrowError(
        /no choices/i,
      );
    });
  });
});
