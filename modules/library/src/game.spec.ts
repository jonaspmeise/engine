import { jest, describe, test, expect, spyOn, afterEach } from 'bun:test';
import { Game } from './game';
import { Action } from './action';
import { Entity } from './entity';
import { EntityID } from './entity.types';

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
  generateId(): EntityID {
    return `testentityC-${this._id}`;
  }
}

class TestGame extends Game<any> {
  public name = 'TestGame';

  initialize() {
    return {
      value: 42,
    };
  }
  *enrichen() {
    yield new TestEntityA(1);
    yield new TestEntityA(2);
    yield new TestEntityA(3);

    yield new TestEntityB(1);
    yield new TestEntityB(2);

    // TestEntityC also should count as TestEntityB since its a subclass!
    yield new TestEntityC(1);
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
        { id: () => 'entity1' },
        { id: () => 'entity1' },
      ]);

      // WHEN / THEN
      expect(() => new TestGame()).toThrowError(/duplicate/gi);
    });
  });

  describe('entitySet', () => {
    test('enriches the game with entities returned by the enrichen generator.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.entitySet()).toHaveLength(6);
      expect(game.entitySet(TestEntityA)).toHaveLength(3);
      expect(game.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(game.entitySet(TestEntityC)).toHaveLength(1);
    });
  });

  describe('entities', () => {
    test('enriches the game with entities returned by the enrichen generator.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.entities()).toHaveLength(6);
      expect(game.entities(TestEntityA)).toHaveLength(3);
      expect(game.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(game.entitySet(TestEntityC)).toHaveLength(1);
    });
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
});
