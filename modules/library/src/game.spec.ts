import { jest, describe, test, expect, spyOn, afterEach, mock } from 'bun:test';
import { Game } from './game';
import { Action } from './components/action';
import { Entity } from './components/entity';
import { EntityID, id } from './components/entity.types';
import { QueryableRuntime } from './interfaces/queryable-runtime';
import {
  playerId,
  PlayerInterface,
  playerInterfaceMarker,
} from './interfaces/player-interface';
import { Logger } from './game.types';
import { PositiveRule } from './components/positive-rule';
import { timeout } from '../tests/utility.spec';

class TestEntityA extends Entity<TestGameState> {
  constructor(protected readonly _id: number) {
    super();
  }
  persist(_state: TestGameState): void {
    // No persist is needed here.
  }
  generateId(): EntityID {
    return `testentityA-${this._id}`;
  }
}

class TestEntityB extends Entity<TestGameState> {
  constructor(protected readonly _id: number) {
    super();
  }
  persist(_state: TestGameState): void {
    // No persist is needed here.
  }
  generateId(): EntityID {
    return `testentityB-${this._id}`;
  }
}

class TestEntityC extends TestEntityB {
  public volatileNumber: number = 0;

  generateId(): EntityID {
    return `testentityC-${this._id}`;
  }

  persist(state: TestGameState): void {
    state.c.values[this._id - 1] = this.volatileNumber;
  }
}

class TestPlayerEntity
  extends Entity<TestGameState>
  implements PlayerInterface<TestGameState>
{
  constructor(protected readonly _id: number) {
    super();
  }
  [playerInterfaceMarker] = true as const;

  persist(
    _state: TestGameState,
    _runtime: QueryableRuntime<TestGameState>,
  ): void {
    //
  }
  protected generateId(): EntityID {
    return `testPlayerEntity-${this._id}`;
  }
}

type TestGameState = {
  [key in 'a' | 'b' | 'c']: {
    count: number;
    values: number[];
  };
};

class TestAction extends Action<TestGameState> {
  apply(_runtime: QueryableRuntime<TestGameState>): void {
    // TODO: All the entity accessors should only reveal "ID", but not the internal "persist" and "generateId" methods to the developer!
    _runtime.anyEntity<TestEntityC>(TestEntityC)!.volatileNumber++;
  }
}

class TestGame extends Game<TestGameState, undefined> {
  public name = 'TestGame';

  initialize() {
    return {
      // Simple encoding: {TestEntityClassName} -> # of entities of that class.
      a: { count: 3, values: [] },
      b: { count: 2, values: [] },
      c: { count: 1, values: [0] },
    };
  }
  enrichen(state: TestGameState) {
    const entities: Entity<TestGameState>[] = [];

    for (let a = 1; a <= state.a.count; a++) {
      entities.push(new TestEntityA(a));
    }

    for (let b = 1; b <= state.b.count; b++) {
      entities.push(new TestEntityB(b));
    }

    for (let c = 1; c <= state.c.count; c++) {
      // TestEntityC also should count as TestEntityB since its a subclass!
      entities.push(new TestEntityC(c));
    }

    entities.push(new TestPlayerEntity(1));
    entities.push(new TestPlayerEntity(2));

    return entities;
  }
  actions() {
    // TODO: Return class? Or instance? Instance is a choice, which might be wrong here...
    return new Set<Action<any, any>>([TestAction]);
  }
  positiveRules(): Set<PositiveRule<TestGameState>> {
    return new Set<PositiveRule<TestGameState>>([
      {
        name: 'test-positive-rule',
        apply: (runtime) =>
          runtime.entities(TestPlayerEntity).map((player) => ({
            action: TestAction,
            parameters: undefined,
            player,
          })),
      },
    ]);
  }
  negativeRules(): void {}
}

describe('game', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const logger: Logger = {
    log: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  };

  describe('setup', () => {
    test('calls initialize on game instantiation.', () => {
      // GIVEN when we instantiate an instance of our Testgame, initialize is called once.
      const initializeMock = spyOn(TestGame.prototype, 'initialize');

      // WHEN
      new TestGame();

      // THEN
      expect(initializeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('initialize', () => {
    test('throws an error if a game without any action is initialized.', () => {
      // GIVEN / WHEN / THEN
      class NoActionGame extends TestGame {
        actions() {
          return new Set<Action<any, any>>();
        }
      }

      expect(() => new NoActionGame()).toThrowError(/no actions/gi);
    });

    test('throws an error if a game without any positive rule is initialized.', () => {
      // GIVEN / WHEN / THEN
      class NoPositiveRuleGame extends TestGame {
        positiveRules(): Set<PositiveRule<TestGameState>> {
          return new Set<PositiveRule<TestGameState>>();
        }
      }

      expect(() => new NoPositiveRuleGame()).toThrowError(
        /no positive rules/gi,
      );
    });

    test('throws an error if an entity is registered with an ID that is already taken by another entity.', () => {
      // GIVEN
      spyOn(TestGame.prototype, 'enrichen').mockReturnValue([
        new TestEntityA(1),
        new TestEntityA(1),
      ]);

      // WHEN / THEN
      expect(() => new TestGame()).toThrowError(/duplicate/gi);
    });

    test.each([null, undefined, {}])(
      'throws an error if a game does not initialize a correct state object and instead returns %p.',
      (invalid: any) => {
        // GIVEN
        spyOn(TestGame.prototype, 'initialize').mockReturnValueOnce(invalid);

        // WHEN / THEN
        expect(() => new TestGame()).toThrowError(/invalid/gi);
      },
    );

    test('throws an error if no PlayerInterface-capable entity is spawned. These interfaces are needed to communicate with a player.', () => {
      // GIVEN
      spyOn(TestGame.prototype, 'enrichen').mockReturnValueOnce([
        new TestEntityA(1),
        new TestEntityA(2),
      ]);

      // WHEN / THEN
      expect(() => new TestGame()).toThrowError(/player/i);
    });

    test('player interfaces are assigned a unique ID upon creation.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      const playerInterfaces = game.entities(TestPlayerEntity);

      expect(playerInterfaces).toHaveLength(2);
      expect(playerInterfaces[0]![playerId]).not.toBeNull();
      expect(playerInterfaces[0]![playerId]).not.toBeUndefined();
      expect(playerInterfaces[1]![playerId]).not.toBeNull();
      expect(playerInterfaces[1]![playerId]).not.toBeUndefined();
    });
  });

  describe('entitySet', () => {
    test('enriches the game with entities returned by the enrichen generator.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.entitySet()).toHaveLength(8);
      expect(game.entitySet(TestEntityA)).toHaveLength(3);
      expect(game.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(game.entitySet(TestEntityC)).toHaveLength(1);
      expect(game.entitySet(TestPlayerEntity)).toHaveLength(2);
    });
  });

  describe('entity', () => {
    test('returns any entity of the given type if there are multiple entities of that type.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.anyEntity(TestEntityA)).toMatchObject({
        [id]: expect.stringMatching(/testentityA-[1-3]/),
      });
    });

    test('returns null if there are no entities of the given type.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(
        game.anyEntity(
          class NonExistingEntity extends Entity<any> {
            protected generateId(): EntityID {
              throw new Error('Method not implemented.');
            }
            persist(): void {
              throw new Error('Method not implemented.');
            }
          },
        ),
      ).toBeNull();
    });
  });

  describe('entities', () => {
    test('enriches the game with entities returned by the enrichen generator.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.entities()).toHaveLength(8);
      expect(game.entities(TestEntityA)).toHaveLength(3);
      expect(game.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(game.entitySet(TestEntityC)).toHaveLength(1);
      expect(game.entitySet(TestPlayerEntity)).toHaveLength(2);
    });
  });

  describe('state', () => {
    test('is initialized with the object returned by the initialize method.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.state()).toEqual({
        a: {
          count: 3,
          values: [],
        },
        b: {
          count: 2,
          values: [],
        },
        c: {
          count: 1,
          values: [0],
        },
      });
    });
  });

  describe('flush', () => {
    test('when an entity is spawned, and that entity is modified, it is flushed.', () => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      game.anyEntity(TestEntityC)!.volatileNumber = 42;

      // THEN
      expect(game.state()).toEqual({
        a: { count: 3, values: [] },
        b: { count: 2, values: [] },
        c: { count: 1, values: [42] },
      });
    });
  });

  describe('registerPlayerCallback', () => {
    test('issues a warning if a callback is registered when another callback is already registered.', () => {
      // GIVEN
      const game = new TestGame(undefined, { logger });

      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        () => {},
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        () => {},
      );

      // THEN #1
      expect(logger.warn).toHaveBeenCalledTimes(0);

      // WHEN
      // The same player interface is overwritten!
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        () => {},
      );

      // THEN #2
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/overwrit/gi),
      );
    });

    test('the game does not start the game until all players interfaces have handlers registered.', () => {
      // GIVEN
      const game = new TestGame();

      const player1Callback = mock(() => {});
      const player2Callback = mock(() => {});

      // WHEN #1
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );

      // THEN #1
      expect(player1Callback).toHaveBeenCalledTimes(0);
      expect(player2Callback).toHaveBeenCalledTimes(0);

      // WHEN #2
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        player2Callback,
      );

      // THEN #2
      expect(player1Callback).toHaveBeenCalledTimes(1);
      expect(player2Callback).toHaveBeenCalledTimes(1);
    });

    test('starts the game when all player interfaces have handlers registered.', () => {
      // GIVEN
      const game = new TestGame();

      const playerCallback1 = mock(() => {});
      const playerCallback2 = mock(() => {});

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        playerCallback1,
      );

      expect(playerCallback1).toHaveBeenCalledTimes(0);
      expect(playerCallback2).toHaveBeenCalledTimes(0);

      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        playerCallback2,
      );

      // THEN
      expect(playerCallback1).toHaveBeenCalledTimes(1);
      expect(playerCallback2).toHaveBeenCalledTimes(1);
    });

    test('if a player interface registers a callback while the game is already running, only the callback is replaced.', () => {
      // GIVEN
      const player1Callback = mock(() => {});
      const player2Callback = mock(() => {});

      const game = new TestGame();
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        player2Callback,
      );

      // THEN #1
      expect(player1Callback).toHaveBeenCalledTimes(1);
      expect(player2Callback).toHaveBeenCalledTimes(1);

      // WHEN
      // A single player callback is overwritten, maybe because the client disconnected and reconnected.
      // In this case, the second player should not be informed about this, and only the reconnected
      // player should be informed about their state again.
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );

      // THEN
      expect(player1Callback).toHaveBeenCalledTimes(2);
      expect(player2Callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle', () => {
    test.todo(
      'logs an error if two players have a choice at the same time.',
      () => {},
    );

    test('the game starts when all player interfaces have registered a callback. players are informed about the initial state.', (done) => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      let player1Informed = false;
      let player2Informed = false;

      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (delta, choices) => {
          expect(delta).toEqual({
            a: { count: 3, values: [] },
            b: { count: 2, values: [] },
            c: { count: 1, values: [0] },
          });

          expect(choices).toBeDefined();
          expect(choices).toHaveLength(1);

          player1Informed = true;
          if (player2Informed) {
            done();
          }
        },
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        (delta, choices) => {
          expect(delta).toEqual({
            a: { count: 3, values: [] },
            b: { count: 2, values: [] },
            c: { count: 1, values: [0] },
          });

          expect(choices).toBeDefined();
          expect(choices).toHaveLength(1);

          player2Informed = true;
          if (player1Informed) {
            done();
          }
        },
      );
    });

    test.todo(
      'sends only modified entities of the state to the player after a choice is picked. choices reset.',
      (done) => {
        // GIVEN
        const game = new TestGame();

        // WHEN
        let snapshotCount = 0;

        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          (delta, choices, executor) => {
            snapshotCount++;

            if (snapshotCount === 1) {
              // Initial state - pick a choice!
              // TODO: Remove choices[0].apply from the type here, because the choice should never be applied directly!
              executor(Array.from(choices)[0]!);
            } else {
              // THEN
              expect(delta).toEqual({
                // Only the modified entity should be sent to the player, not the whole state!
                // TODO: Write this down somewhere: We send new entities completely, so the client does not have to make complex diffing logic...?
                c: {
                  count: 1,
                  values: [1],
                },
              });

              done();
            }
          },
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          // Player 2 is not relevant for this test.
          (_delta, _choices) => {},
        );

        timeout(done);
      },
    );

    // TODO: IMPORTANT: IS THE JSON STATE EVEN NEEDED? CAN WE JUST COMMUNICATE THE ENTITY TYPES AND RECREATE THE ERGONOMIC ACCESSORS BASED ON THEIR TYPE?
  });
});
