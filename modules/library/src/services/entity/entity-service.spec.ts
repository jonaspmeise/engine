import {
  jest,
  describe,
  test,
  expect,
  afterEach,
  beforeEach,
  mock,
} from 'bun:test';
import { Entity, entityId } from '../../components/entity';
import { EntityService } from './entity-service';
import { NO_OP_LOGGER } from '../../game/game.types';
import { EntityFlushCallback, PlayerEntity } from './entity-service.types';
import {
  playerId,
  PlayerInterface,
  playerInterfaceMarker,
} from '../../interfaces/player-interface';

class TestEntityA extends Entity {
  public $type: string = 'TestEntityA';
  public volatileNumber: number = 0;

  constructor(readonly _id: number) {
    super(`TestEntityA-${_id}`);
  }
  public toString(): string {
    return `TestEntityA`;
  }
}

class TestEntityB extends Entity {
  public $type: string = 'TestEntityB';
  constructor(readonly _id: number | string) {
    super(typeof _id === 'number' ? `TestEntityB-${_id}` : _id);
  }

  public toString(): string {
    return `TestEntityB`;
  }
}

class TestEntityC extends TestEntityB {
  constructor(id: number) {
    super(`TestEntityC-${id}`);
  }

  public toString(): string {
    return `TestEntityC`;
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
    test.todo(
      'throws an error if an entity is registered with an ID that is already taken by another entity.',
      () => {
        // GIVEN
        service.create(new TestEntityA(1));

        // WHEN / THEN
        expect(() => service.create(new TestEntityA(1))).toThrowError(
          /duplicate/gi,
        );
      },
    );

    test.todo('when an entity is spawned, it is registered.', () => {
      // GIVEN / WHEN
      service.create(new TestEntityA(1));

      // THEN
      expect(service.entities()).toHaveLength(1);
      expect(service.entities(TestEntityA)).toHaveLength(1);
      expect(service.entities(TestEntityA)[0]![entityId]).toBe('TestEntityA-1');
    });

    test.todo(
      'when an entity is spawned, the flush callback is called. The engine needs to be notified of changes to entity state.',
      () => {
        // GIVEN / WHEN
        service.create(new TestEntityA(1));

        // THEN
        expect(callback).toHaveBeenCalledTimes(1);
      },
    );

    test.todo(
      'when the internal state of an entity is modified, the flush callback is called.',
      () => {
        // GIVEN
        const entity = service.create(new TestEntityA(1));

        // WHEN
        entity.volatileNumber = 42;

        // THEN
        expect(callback).toHaveBeenCalledTimes(2); // 1x for spawn + 1x for state change
      },
    );

    test.todo(
      'when the nested internal state of an entity is modified, the flush callback is called.',
      () => {
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
      },
    );

    test.todo(
      'when a symbol property of an entity is modified, the flush callback is not called.',
      () => {
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
      },
    );

    test.todo(
      'when a player entity is spawned, it receives an unique player ID.',
      () => {
        // GIVEN
        const playerEntity = service.create(
          new TestPlayerEntity(1),
        ) as PlayerEntity;

        // THEN
        expect(playerEntity[playerId]).toBeDefined();
        expect(typeof playerEntity[playerId]).toBe('string');
        expect(playerEntity[playerId]!.length).toBeGreaterThan(0);
      },
    );
  });

  describe('destroyEntity', () => {
    test.todo(
      'when an entity is destroyed, it is removed from the registry.',
      () => {
        // GIVEN
        const entity = service.create(new TestEntityA(1));

        // WHEN
        service.destroy(entity);

        // THEN
        expect(service.entities()).toHaveLength(0);
      },
    );

    test.todo(
      'when an entity is destroyed, that is not registered, an error is thrown.',
      () => {
        // GIVEN
        const entity = new TestEntityA(1);

        // WHEN / THEN
        expect(() => service.destroy(entity)).toThrowError();
      },
    );
  });

  describe('entitySet', () => {
    test.todo('returns spawned entities.', () => {
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

    test.todo('has the keys of all types of entities.', () => {
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
    test.todo('returns spawned entities.', () => {
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
    test.todo('returns an empty array if no players are registered.', () => {
      // THEN
      expect(service.players()).toHaveLength(0);
    });

    test.todo(
      'returns spawned entities that implement the PlayerInterface.',
      () => {
        // GIVEN / WHEN
        service.create(new TestPlayerEntity(1));
        service.create(new TestPlayerEntity(2));

        // THEN
        expect(service.players()).toHaveLength(2);
      },
    );
  });

  describe('getNonProxy', () => {
    test.todo(
      'returns the original non-proxy object for a proxied entity.',
      () => {
        // GIVEN
        const entity = service.create(new TestEntityA(1));
        const original = new TestEntityA(1);

        // THEN
        expect(entity).not.toBe(original);
        expect(service.getNonProxy(entity)).toEqual(original);
      },
    );

    test.todo('returns undefined if the entity is not registered.', () => {
      // GIVEN
      const entity = new TestEntityA(1);

      // THEN
      expect(service.getNonProxy(entity)).toBeUndefined();
    });
  });
});
