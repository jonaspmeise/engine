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
  handler,
} from '../../interfaces/player-interface';
import {
  AfterAction,
  BeforeAction,
  CheckAction,
} from '../../components/lifecyclehooks';
import { ModifiableRuntime } from '../../game/modifiable-runtime';
import { Action } from '../../components/action';

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

  describe('clone', () => {
    test('the cloned service contains the same entities as the original.', () => {
      // GIVEN
      service.create(new TestEntityA(1));
      service.create(new TestEntityA(2));
      service.create(new TestEntityB(1));

      // WHEN
      const cloneCallback = () => {};
      const clone = service.clone(cloneCallback);

      // THEN
      expect(clone.entities(TestEntityA)).toHaveLength(2);
      expect(clone.entities(TestEntityB)).toHaveLength(1);
      expect(clone.entities()).toHaveLength(3);
      expect(service.entities(TestEntityA)).toHaveLength(2);
      expect(service.entities(TestEntityB)).toHaveLength(1);
      expect(service.entities()).toHaveLength(3);
    });

    test('the cloned entities are independent copies — modifying one does not affect the other.', () => {
      // GIVEN
      const entity = service.create(new TestEntityA(1));

      // WHEN
      const clone = service.clone(() => {});
      entity.volatileNumber = 42;

      // THEN
      expect(clone.entities(TestEntityA)[0]!.volatileNumber).toBe(0);
      expect(service.entities(TestEntityA)[0]!.volatileNumber).toBe(42);
    });

    test('the cloned service preserves player entities.', () => {
      // GIVEN
      service.create(new TestPlayerEntity(1));
      service.create(new TestPlayerEntity(2));

      // WHEN
      const clone = service.clone(() => {});

      // THEN
      expect(clone.players()).toHaveLength(2);
      expect(service.players()).toHaveLength(2);
    });

    test('player handler callbacks are cleared on cloned entities.', () => {
      // GIVEN
      const player = service.create(new TestPlayerEntity(1)) as PlayerEntity;
      const fakeCallback = { state: () => {}, prompt: () => {} };
      player[handler] = fakeCallback;

      // WHEN
      const clone = service.clone(() => {});
      const clonedPlayer = clone.players()[0]!;

      // THEN
      expect(clonedPlayer[handler]).toBeUndefined();
      expect(player[handler]).toBeDefined();
    });

    test('the flush callback of the clone is called when a cloned entity is modified.', () => {
      // GIVEN
      service.create(new TestEntityA(1));
      const cloneCallback = mock(() => {});
      const clone = service.clone(cloneCallback);

      // WHEN
      clone.entities(TestEntityA)[0]!.volatileNumber = 99;

      // THEN
      expect(cloneCallback).toHaveBeenCalledTimes(2); // 1x for spawn + 1x for state change
      expect(callback).toHaveBeenCalledTimes(1); // original flush not called again
    });
  });

  // A minimal fake action object — only $type matters for hook lookup.
  const markAction = { $type: 'mark' } as unknown as Action<'mark', any, any>;
  const drawAction = { $type: 'draw' } as unknown as Action<'draw', any, any>;

  class AfterMarkEntity
    extends Entity
    implements AfterAction<typeof markAction>
  {
    public $type = 'AfterMarkEntity';
    afterMark(_runtime: ModifiableRuntime, _params: any): void {}
    toString() {
      return 'AfterMarkEntity';
    }
  }

  class BeforeMarkEntity
    extends Entity
    implements BeforeAction<typeof markAction>
  {
    public $type = 'BeforeMarkEntity';
    beforeMark(_runtime: ModifiableRuntime, _params: any): boolean | void {
      return;
    }
    toString() {
      return 'BeforeMarkEntity';
    }
  }

  class CheckMarkEntity
    extends Entity
    implements CheckAction<typeof markAction>
  {
    public $type = 'CheckMarkEntity';
    checkMark(_runtime: ModifiableRuntime, _params: any): boolean {
      return true;
    }
    toString() {
      return 'CheckMarkEntity';
    }
  }

  class AfterDrawEntity
    extends Entity
    implements AfterAction<typeof drawAction>
  {
    public $type = 'AfterDrawEntity';
    afterDraw(_runtime: ModifiableRuntime, _params: any): void {}
    toString() {
      return 'AfterDrawEntity';
    }
  }

  class MultiHookEntity
    extends Entity
    implements AfterAction<typeof markAction>, BeforeAction<typeof markAction>
  {
    public $type = 'MultiHookEntity';
    afterMark(_runtime: ModifiableRuntime, _params: any): void {}
    beforeMark(_runtime: ModifiableRuntime, _params: any): boolean | void {
      return;
    }
    toString() {
      return 'MultiHookEntity';
    }
  }

  describe('getHook', () => {
    test('returns an entity that has an after-hook for the given action.', () => {
      // GIVEN
      const entity = service.create(new AfterMarkEntity('after-mark-1'));

      // WHEN / THEN
      expect(service.getHook('after', markAction)).toContain(entity);
      expect(service.getHook('after', markAction)).toHaveLength(1);
      expect(service.getHook('before', markAction)).toHaveLength(0);
      expect(service.getHook('check', markAction)).toHaveLength(0);
    });

    test('returns an entity that has a before-hook for the given action.', () => {
      // GIVEN
      const entity = service.create(new BeforeMarkEntity('before-mark-1'));

      // WHEN / THEN
      expect(service.getHook('before', markAction)).toContain(entity);
      expect(service.getHook('before', markAction)).toHaveLength(1);
      expect(service.getHook('after', markAction)).toHaveLength(0);
      expect(service.getHook('check', markAction)).toHaveLength(0);
    });

    test('returns an entity that has a check-hook for the given action.', () => {
      // GIVEN
      const entity = service.create(new CheckMarkEntity('check-mark-1'));

      // WHEN / THEN
      expect(service.getHook('check', markAction)).toContain(entity);
      expect(service.getHook('check', markAction)).toHaveLength(1);
      expect(service.getHook('before', markAction)).toHaveLength(0);
      expect(service.getHook('after', markAction)).toHaveLength(0);
    });

    test('does not return an entity that has no hook for the given action.', () => {
      // GIVEN
      service.create(new TestEntityA(1));

      // WHEN / THEN
      expect(service.getHook('after', markAction)).toHaveLength(0);
      expect(service.getHook('before', markAction)).toHaveLength(0);
      expect(service.getHook('check', markAction)).toHaveLength(0);
    });

    test('does not cross-pollinate action types — an afterDraw entity is not returned for afterMark.', () => {
      // GIVEN
      const afterMark = service.create(new AfterMarkEntity('after-mark-3'));
      const afterDraw = service.create(new AfterDrawEntity('after-draw-1'));

      // WHEN / THEN
      expect(service.getHook('after', markAction)).toContain(afterMark);
      expect(service.getHook('after', markAction)).toHaveLength(1);
      expect(service.getHook('after', drawAction)).toContain(afterDraw);
      expect(service.getHook('after', drawAction)).toHaveLength(1);
    });

    test('returns multiple entities when several have the same hook.', () => {
      // GIVEN
      const e1 = service.create(new AfterMarkEntity('after-mark-4'));
      const e2 = service.create(new AfterMarkEntity('after-mark-5'));

      // WHEN
      const result = service.getHook('after', markAction);

      // THEN
      expect(result).toContain(e1);
      expect(result).toContain(e2);
      expect(result).toHaveLength(2);
    });

    test('an entity with both after and before hooks for the same action appears in both maps.', () => {
      // GIVEN
      const entity = service.create(new MultiHookEntity('multi-1'));

      // WHEN / THEN
      expect(service.getHook('after', markAction)).toContain(entity);
      expect(service.getHook('before', markAction)).toContain(entity);
      expect(service.getHook('check', markAction)).toHaveLength(0);
    });

    test('a destroyed entity is no longer returned by getHook.', () => {
      // GIVEN
      const entity = service.create(new AfterMarkEntity('after-mark-6'));
      expect(service.getHook('after', markAction)).toContain(entity);

      // WHEN
      service.destroy(entity);

      // THEN
      expect(service.getHook('after', markAction)).toHaveLength(0);
    });

    test('returns an empty array for an action with no registered hooks.', () => {
      // GIVEN — no entity with afterMark registered

      // WHEN / THEN
      expect(service.getHook('after', markAction)).toHaveLength(0);
    });

    test('dynamically assigning a hook method on an entity registers it in the map.', () => {
      // GIVEN
      const entity = service.create(new TestEntityA(99));
      expect(service.getHook('after', markAction)).toHaveLength(0);

      // WHEN — simulate dynamic hook assignment via the proxy
      (entity as any).afterMark = (
        _runtime: ModifiableRuntime,
        _params: any,
      ): void => {};

      // THEN
      expect(service.getHook('after', markAction)).toContain(entity);
      expect(service.getHook('before', markAction)).toHaveLength(0);
      expect(service.getHook('check', markAction)).toHaveLength(0);
    });

    test('the cloned service has the same hook registrations as the original.', () => {
      // GIVEN
      const entity = service.create(new AfterMarkEntity('after-mark-7'));

      // WHEN
      const clone = service.clone(() => {});

      // THEN
      expect(clone.getHook('after', markAction)).toHaveLength(1);
      expect(clone.getHook('after', markAction)[0]![entityId]).toBe(
        entity[entityId],
      );
      expect(service.getHook('after', markAction)).toHaveLength(1);
      expect(service.getHook('after', markAction)[0]![entityId]).toBe(
        entity[entityId],
      );
    });
  });
});
