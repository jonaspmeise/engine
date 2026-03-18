import {
  jest,
  describe,
  test,
  expect,
  spyOn,
  afterEach,
  beforeEach,
} from 'bun:test';
import { Entity } from '../entity';
import { EntityID } from '../entity.types';
import { EntityService } from './entity-service';
import { NO_OP_LOGGER } from '../game.types';

class TestEntityA extends Entity<any> {
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

  beforeEach(() => {
    service = new EntityService(NO_OP_LOGGER);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('spawnEntity', () => {
    test('throws an error if an entity is registered with an ID that is already taken by another entity.', () => {
      // GIVEN
      service.spawnEntity(new TestEntityA(1));

      // WHEN / THEN
      expect(() => service.spawnEntity(new TestEntityA(1))).toThrowError(
        /duplicate/gi,
      );
    });
  });

  describe('entitySet', () => {
    test('returns spawned entities.', () => {
      // GIVEN / WHEN
      service.spawnEntity(new TestEntityA(1));
      service.spawnEntity(new TestEntityA(2));
      service.spawnEntity(new TestEntityA(3));

      service.spawnEntity(new TestEntityB(1));
      service.spawnEntity(new TestEntityB(2));

      service.spawnEntity(new TestEntityC(1));

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
      service.spawnEntity(new TestEntityA(1));
      service.spawnEntity(new TestEntityA(2));
      service.spawnEntity(new TestEntityA(3));

      service.spawnEntity(new TestEntityB(1));
      service.spawnEntity(new TestEntityB(2));

      service.spawnEntity(new TestEntityC(1));

      // THEN
      expect(service.entities()).toHaveLength(6);
      expect(service.entities(TestEntityA)).toHaveLength(3);
      expect(service.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityAB + 1x TestEntityAC
      expect(service.entitySet(TestEntityC)).toHaveLength(1);
    });
  });
});
