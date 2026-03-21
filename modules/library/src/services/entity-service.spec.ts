import {
  jest,
  describe,
  test,
  expect,
  spyOn,
  afterEach,
  beforeEach,
  mock,
} from 'bun:test';
import { Entity } from '../entity';
import { EntityID } from '../entity.types';
import { EntityService } from './entity-service';
import { NO_OP_LOGGER } from '../game.types';
import { EntityFlushCallback } from './entity-service.types';

class TestEntityA extends Entity<any> {
  public volatileNumber: number = 0;

  persist(state: any): void {
    // Do nothing...
  }
  protected generateId(): EntityID {
    return `TestEntityA-${this._id}`;
  }
  constructor(protected readonly _id: number) {
    super();
  }
}

class TestEntityB extends Entity<any> {
  persist(state: any): void {
    // Do nothing...
  }
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

describe('entityService', () => {
  let service: EntityService<any>;
  let callback: EntityFlushCallback;

  beforeEach(() => {
    callback = mock(() => {});
    service = new EntityService(NO_OP_LOGGER, callback);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('spawn', () => {
    test('throws an error if an entity is registered with an ID that is already taken by another entity.', () => {
      // GIVEN
      service.spawn(new TestEntityA(1));

      // WHEN / THEN
      expect(() => service.spawn(new TestEntityA(1))).toThrowError(
        /duplicate/gi,
      );
    });

    test('when an entity is spawned, it is registered.', () => {
      // GIVEN / WHEN
      service.spawn(new TestEntityA(1));

      // THEN
      expect(service.entities()).toHaveLength(1);
      expect(service.entities(TestEntityA)).toHaveLength(1);
      expect(service.entities(TestEntityA)[0].id()).toBe('TestEntityA-1');
    });

    test('when an entity is spawned, the flush callback is called. The engine needs to be notified of changes to entity state.', () => {
      // GIVEN / WHEN
      service.spawn(new TestEntityA(1));

      // THEN
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('when the internal state of an entity is modified, the flush callback is called.', () => {
      // GIVEN
      const entity = service.spawn(new TestEntityA(1));

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
      const entity = service.spawn(new TestEntityD(1));
      entity.nested.value = 42;

      // THEN
      expect(callback).toHaveBeenCalledTimes(2); // 1x for spawn + 1x for state change
    });
  });

  describe('entitySet', () => {
    test('returns spawned entities.', () => {
      // GIVEN / WHEN
      service.spawn(new TestEntityA(1));
      service.spawn(new TestEntityA(2));
      service.spawn(new TestEntityA(3));

      service.spawn(new TestEntityB(1));
      service.spawn(new TestEntityB(2));

      service.spawn(new TestEntityC(1));

      // THEN
      expect(service.entitySet()).toHaveLength(6);
      expect(service.entitySet(TestEntityA)).toHaveLength(3);
      expect(service.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(service.entitySet(TestEntityC)).toHaveLength(1);
    });
  });

  describe('entities', () => {
    test('returns spawned entities.', () => {
      // GIVEN / WHEN
      service.spawn(new TestEntityA(1));
      service.spawn(new TestEntityA(2));
      service.spawn(new TestEntityA(3));

      service.spawn(new TestEntityB(1));
      service.spawn(new TestEntityB(2));

      service.spawn(new TestEntityC(1));

      // THEN
      expect(service.entities()).toHaveLength(6);
      expect(service.entities(TestEntityA)).toHaveLength(3);
      expect(service.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityAB + 1x TestEntityAC
      expect(service.entitySet(TestEntityC)).toHaveLength(1);
    });
  });
});
