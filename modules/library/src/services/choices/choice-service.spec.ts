import { describe, test, expect, mock, spyOn, jest } from 'bun:test';
import { ChoiceService } from './choice-service';
import { Action } from '../../components/action';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../../interfaces/player-interface';
import { QueryableRuntime } from '../../interfaces/queryable-runtime';
import { Choice, EnhancedChoice } from '../../components/choice';
import { ModifiableRuntime } from '../../interfaces/modifiable-runtime';
import { Entity } from '../../components/entity';
import { beforeEach } from 'node:test';
import { GeneratorRule } from '../../components/rules/generator-rule';

class TestEntity extends Entity {
  public $type: string = 'TestEntity';
  public value: number = 0;

  constructor(readonly _id: number) {
    super(`TestEntity-${_id}`);
  }

  public toString(): string {
    return `TestEntity`;
  }
}

class TestActionA extends Action<
  'TestActionA',
  { shouldBePrevented: boolean } | undefined
> {
  public message(): string {
    return 'TestActionA executed!';
  }
  public prompt(): string {
    return 'Execute TestActionA';
  }
  public affectedEntities(runtime: QueryableRuntime): Entity[] | void {
    return [runtime.anyEntity<TestEntity>(TestEntity)!];
  }
  async doApply(runtime: ModifiableRuntime): Promise<void> {
    runtime.anyEntity<TestEntity>(TestEntity)!.value++;
  }

  public $type: 'TestActionA' = 'TestActionA';
}

class TestPlayer extends Entity implements PlayerInterface {
  public $type: 'TestPlayer' = 'TestPlayer';

  constructor() {
    super(`player-${Math.random()}`);
  }

  public toString(): string {
    return `TestPlayer`;
  }

  [playerInterfaceMarker] = true as const;
}

describe('ChoiceService', () => {
  const mockRuntime: QueryableRuntime = {
    anyEntity: mock(() => null),
    entities: mock(() => []),
    entitySet: mock(() => new Set()),
    history: mock(() => []),
    players: mock(() => []),
    status: mock(() => 'running'),
  } as QueryableRuntime;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('throws an error if no generator rules are provided. A game without generator rules is not possible.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new ChoiceService({
            generatorRules: new Set() as Set<GeneratorRule<any>>,
          }),
      ).toThrowError(/no generator rules/gi);
    });

    test('throws an error if any generator rules have duplicate names.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new ChoiceService({
            generatorRules: new Set([
              {
                name: 'TestgeneratorRule',
                apply: () => [],
              },
              {
                name: 'TestgeneratorRule',
                apply: () => [],
              },
            ]),
          }),
      ).toThrowError(/duplicate/gi);
    });

    test('throws an error if any filter rules have duplicate names.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new ChoiceService({
            generatorRules: new Set([
              {
                name: 'TestgeneratorRule',
                apply: () => [],
              },
            ]),
            filterRules: new Set([
              {
                name: 'TestfilterRule',
                apply: () => false,
              },
              {
                name: 'TestfilterRule',
                apply: () => false,
              },
            ]),
          }),
      ).toThrowError(/duplicate/gi);
    });

    test('throws an error if any generator or filter rules have duplicate names.', () => {
      // GIVEN / WHEN / THEN
      expect(
        () =>
          new ChoiceService({
            generatorRules: new Set([
              {
                name: 'TestRule',
                apply: () => [],
              },
            ]),
            filterRules: new Set([
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
    test('returns the correct choice space given only generator rules.', () => {
      // GIVEN
      const service = new ChoiceService({
        generatorRules: new Set([
          {
            name: 'TestgeneratorRule',
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
      const service = new ChoiceService({
        generatorRules: new Set([
          {
            name: 'TestgeneratorRule',
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

    test('filter rules prevent choices from being generated.', () => {
      // GIVEN
      const service = new ChoiceService({
        generatorRules: new Set([
          {
            name: 'TestgeneratorRule',
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
        filterRules: new Set([
          {
            name: 'TestfilterRule',
            apply: (
              choice: Choice<Action<string, any>>,
              _runtime: QueryableRuntime,
            ) =>
              (choice.execution as TestActionA).parameters?.shouldBePrevented ??
              false,
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
      const service = new ChoiceService({
        generatorRules: new Set([
          {
            name: 'TestgeneratorRule',
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
