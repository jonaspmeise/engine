import {
  jest,
  describe,
  test,
  expect,
  afterEach,
  beforeEach,
  mock,
} from 'bun:test';
import { Entity } from '../../components/entity';
import { EntityID } from '../../components/entity.types';
import { EntityService } from './entity-service';
import { NO_OP_LOGGER } from '../../game.types';
import { EntityFlushCallback, PlayerEntity } from './entity-service.types';
import {
  playerId,
  PlayerInterface,
  playerInterfaceMarker,
} from '../../interfaces/player-interface';

class TestEntityA extends Entity {
  public volatileNumber: number = 0;

  protected generateId(): EntityID {
    return `TestEntityA-${this._id}`;
  }
  constructor(protected readonly _id: number) {
    super();
  }
}

class TestEntityB extends Entity {
  protected generateId(): EntityID {
    return `TestEntityB-${this._id}`;
  }
  constructor(protected readonly _id: number) {
    super();
  }
}

class TestEntityC extends TestEntityB {
  protected generateId(): EntityID {
    return `TestEntityC-${this._id}`;
  }
}

class TestPlayerEntity extends TestEntityA implements PlayerInterface {
  [playerInterfaceMarker] = true as const;
}

describe('entityService', () => {
  let service: EntityService;
  let callback: EntityFlushCallback;

  beforeEach(() => {
    callback = mock(() => {});
    service = new EntityService(NO_OP_LOGGER, callback);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('spawnEntity', () => {
    test('throws an error if an entity is registered with an ID that is already taken by another entity.', () => {
      // GIVEN
      service.create(new TestEntityA(1));

      // WHEN / THEN
      expect(() => service.create(new TestEntityA(1))).toThrowError(
        /duplicate/gi,
      );
    });

    test('when an entity is spawned, it is registered.', () => {
      // GIVEN / WHEN
      service.create(new TestEntityA(1));

      // THEN
      expect(service.entities()).toHaveLength(1);
      expect(service.entities(TestEntityA)).toHaveLength(1);
      expect(service.entities(TestEntityA)[0]!.id()).toBe('TestEntityA-1');
    });

    test('when an entity is spawned, the flush callback is called. The engine needs to be notified of changes to entity state.', () => {
      // GIVEN / WHEN
      service.create(new TestEntityA(1));

      // THEN
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('when the internal state of an entity is modified, the flush callback is called.', () => {
      // GIVEN
      const entity = service.create(new TestEntityA(1));

      // WHEN
      entity.volatileNumber = 42;

      // THEN
      expect(callback).toHaveBeenCalledTimes(2); // 1x for spawn + 1x for state change
    });

    test('when the nested internal state of an entity is modified, the flush callback is called.', () => {
      // GIVEN
      class TestEntityD extends TestEntityA {
        public nested = {
          value: 0,
        };
      }

      // WHEN
      const entity = service.create(new TestEntityD(1));
      entity.nested.value = 42;

      // THEN
      expect(callback).toHaveBeenCalledTimes(2); // 1x for spawn + 1x for state change
    });

    test('when a symbol property of an entity is modified, the flush callback is not called.', () => {
      // GIVEN
      const symbolKey = Symbol('test');

      class TestEntityE extends TestEntityA {
        public [symbolKey]: number = 0;
      }

      // WHEN
      const entity = service.create(new TestEntityE(1));
      entity[symbolKey] = 42;

      // THEN
      expect(callback).toHaveBeenCalledTimes(1); // Only the initial spawn, not the symbol property change
    });

    test('when a player entity is spawned, it receives an unique player ID.', () => {
      // GIVEN
      const playerEntity = service.create(
        new TestPlayerEntity(1),
      ) as PlayerEntity;

      // THEN
      expect(playerEntity[playerId]).toBeDefined();
      expect(typeof playerEntity[playerId]).toBe('string');
      expect(playerEntity[playerId]!.length).toBeGreaterThan(0);
    });
  });

  describe('destroyEntity', () => {
    test('when an entity is destroyed, it is removed from the registry.', () => {
      // GIVEN
      const entity = service.create(new TestEntityA(1));

      // WHEN
      service.destroy(entity);

      // THEN
      expect(service.entities()).toHaveLength(0);
    });

    test('when an entity is destroyed, that is not registered, an error is thrown.', () => {
      // GIVEN
      const entity = new TestEntityA(1);

      // WHEN / THEN
      expect(() => service.destroy(entity)).toThrowError();
    });
  });

  describe('entitySet', () => {
    test('returns spawned entities.', () => {
      // GIVEN / WHEN
      service.create(new TestEntityA(1));
      service.create(new TestEntityA(2));
      service.create(new TestEntityA(3));

      service.create(new TestEntityB(1));
      service.create(new TestEntityB(2));

      service.create(new TestEntityC(1));

      // THEN
      expect(service.entitySet()).toHaveLength(6);
      expect(service.entitySet(TestEntityA)).toHaveLength(3);
      expect(service.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(service.entitySet(TestEntityC)).toHaveLength(1);
    });

    test('has the keys of all types of entities.', () => {
      // GIVEN / WHEN
      service.create(new TestEntityA(1));
      service.create(new TestEntityB(1));
      service.create(new TestEntityC(1));

      // THEN
      expect(service.entitySet(TestEntityA).size).toBe(1);
      expect(service.entitySet(TestEntityB).size).toBe(2); // TestEntityB + TestEntityC
      expect(service.entitySet(TestEntityC).size).toBe(1);
      expect(service.entitySet(Entity).size).toBe(3);

      // This is a little bit cheating, but we care about that no unnecessary types are created.
      const types = Array.from(service['_entities'].types.keys());
      expect(types).toContain(TestEntityA);
      expect(types).toContain(TestEntityB);
      expect(types).toContain(TestEntityC);
      expect(types).toContain(Entity);
      expect(types).toHaveLength(4);
    });
  });

  describe('entities', () => {
    test('returns spawned entities.', () => {
      // GIVEN / WHEN
      service.create(new TestEntityA(1));
      service.create(new TestEntityA(2));
      service.create(new TestEntityA(3));

      service.create(new TestEntityB(1));
      service.create(new TestEntityB(2));

      service.create(new TestEntityC(1));

      // THEN
      expect(service.entities()).toHaveLength(6);
      expect(service.entities(TestEntityA)).toHaveLength(3);
      expect(service.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(service.entitySet(TestEntityC)).toHaveLength(1);
    });
  });

  describe('players', () => {
    test('returns an empty array if no players are registered.', () => {
      // THEN
      expect(service.players()).toHaveLength(0);
    });

    test('returns spawned entities that implement the PlayerInterface.', () => {
      // GIVEN / WHEN
      service.create(new TestPlayerEntity(1));
      service.create(new TestPlayerEntity(2));

      // THEN
      expect(service.players()).toHaveLength(2);
    });
  });
});
