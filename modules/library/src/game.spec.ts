import { jest, describe, test, expect, spyOn, afterEach, mock } from 'bun:test';
import { Game } from './game';
import { Action } from './action';
import { Entity } from './entity';
import { EntityID, id } from './entity.types';
import { QueryableRuntime } from './queryable-runtime';
import {
  playerId,
  PlayerInterface,
  playerInterfaceMarker,
} from './player-interface';

class TestEntityA extends Entity<any> {
  constructor(protected readonly _id: number) {
    super();
  }
  persist(state: any): void {
    // No persist is needed here.
  }
  generateId(): EntityID {
    return `testentityA-${this._id}`;
  }
}

class TestEntityB extends Entity<any> {
  constructor(protected readonly _id: number) {
    super();
  }
  persist(state: any): void {
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

class TestPlayerEntity extends Entity<any> implements PlayerInterface<any> {
  constructor(protected readonly _id: number) {
    super();
  }
  [playerInterfaceMarker] = true as const;

  persist(state: any, runtime: QueryableRuntime<any, any, any>): void {
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
  *enrichen(state: TestGameState) {
    for (let a = 1; a <= state.a.count; a++) {
      yield new TestEntityA(a);
    }

    for (let b = 1; b <= state.b.count; b++) {
      yield new TestEntityB(b);
    }

    for (let c = 1; c <= state.c.count; c++) {
      // TestEntityC also should count as TestEntityB since its a subclass!
      yield new TestEntityC(c);
    }

    yield new TestPlayerEntity(1);
    yield new TestPlayerEntity(2);
  }
  actions() {
    return new Set<Action<any, any>>();
  }
}

describe('game', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    test.todo(
      'issues a warning if a game that is already initialized, is initialized again.',
    );

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
      expect(playerInterfaces[0][playerId]).not.toBeNull();
      expect(playerInterfaces[0][playerId]).not.toBeUndefined();
      expect(playerInterfaces[1][playerId]).not.toBeNull();
      expect(playerInterfaces[1][playerId]).not.toBeUndefined();
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
      expect(game.entity(TestEntityA)).toMatchObject({
        [id]: expect.stringMatching(/testentityA-[1-3]/),
      });
    });

    test('returns null if there are no entities of the given type.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(
        game.entity(
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
      game.entity(TestEntityC)!.volatileNumber = 42;

      // THEN
      expect(game.state()).toEqual({
        a: { count: 3, values: [] },
        b: { count: 2, values: [] },
        c: { count: 1, values: [42] },
      });
    });
  });

  describe('registerPlayerCallback', () => {
    test.todo(
      'issues a warning if a callback is registered when another callback is already registered.',
      () => {},
    );

    // TODO: Maybe move this into the more general part.
    test.todo(
      'the game does not start the game until all players interfaces have handlers registered.',
    );

    test('starts the game when all player interfaces have handlers registered.', () => {
      // GIVEN
      const game = new TestGame();

      const playerCallback1 = mock(() => {});
      const playerCallback2 = mock(() => {});

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0],
        playerCallback1,
      );

      expect(playerCallback1).toHaveBeenCalledTimes(0);
      expect(playerCallback2).toHaveBeenCalledTimes(0);

      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1],
        playerCallback2,
      );

      // THEN
      expect(playerCallback1).toHaveBeenCalledTimes(1);
      expect(playerCallback2).toHaveBeenCalledTimes(1);
    });

    test.todo(
      'if a player interface registers a callback while the game is already running, only the callback is replaced.',
    );
  });
});
