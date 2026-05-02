/// <reference lib="dom" />
import { describe, test, mock, beforeEach, jest, expect } from 'bun:test';
import { Entity, entityId } from '@my-engine/library';
import { ClientEntityHandler } from './client-entity-handler';
import { ClientEntity } from './client-entity-handler.types';
import {
  TestEntityA,
  TestEntityC,
} from '../../library/src/game/game.spec.types';

const animate = mock(() => Promise.resolve());
const render = mock(() => {});
const element: HTMLElement = document.createElement('div');

abstract class TestAbstractEntity extends Entity {
  public static readonly $type: string = 'TestAbstractEntity';
}

describe('Client Entity Handler', () => {
  let service: ClientEntityHandler;

  beforeEach(() => {
    service = new ClientEntityHandler(
      {
        TestEntityA: TestEntityA,
        TestEntityC: TestEntityC,
        TestAbstractEntity: TestAbstractEntity,
      },
      console,
    );
    jest.clearAllMocks();
  });

  test.todo('an applied entity delta creates the entity in the service', () => {
    // GIVEN
    const delta: Partial<ClientEntity> = {
      $type: 'TestEntityA',
      name: 'Test Name',
    };
    const id = 'entity-1';

    // WHEN
    service.apply(id, delta);

    // THEN
    const expected: ClientEntity = {
      [entityId]: id,
      $type: 'TestEntityA',
      name: 'Test Name',
      visibility: expect.any(Function),
    };

    expect(service.anyEntity(Entity)).toEqual(expected);
    expect(service.entities(Entity)).toEqual([expected]);
    expect(service.entitySet(Entity)).toEqual(new Set([expected]));
    expect(service.players()).toEqual([]);
  });

  test.todo(
    'an applied entity delta modifies an existing entity in the service',
    () => {
      // GIVEN
      const delta: Partial<ClientEntity> = {
        $type: 'TestEntityA',
        name: 'Test Name',
      };
      const id = 'entity-1';

      // WHEN
      service.apply(id, delta);
      service.apply(id, { name: 'Modified Name' });

      // THEN
      const expected: ClientEntity = {
        [entityId]: id,
        $type: 'TestEntityA',
        name: 'Modified Name',
        visibility: expect.any(Function),
      };

      expect(service.anyEntity(Entity)).toEqual(expected);
      expect(service.entities(Entity)).toEqual([expected]);
      expect(service.entitySet(Entity)).toEqual(new Set([expected]));
      expect(service.players()).toEqual([]);
    },
  );

  test.todo(
    'throws an error if the delta contains an unknown entity type',
    async () => {
      // GIVEN / WHEN
      expect(() =>
        service.apply('test-id', {
          $type: 'UnknownEntity',
          name: 'Modified Name',
        }),
      ).toThrow('Unknown entity type: UnknownEntity');
    },
  );

  test.todo(
    'multiple snapshots passed are correctly parsed into the client state.',
    async () => {
      // GIVEN / WHEN
      service.apply('testentityC-0', {
        $type: 'TestEntityC',
      });
      service.apply('testentityC-0', {
        $type: 'TestEntityC',
        volatileNumber: 42,
      });

      // THEN
      const expected = new TestEntityC(0);
      expected.volatileNumber = 42;

      expect(service.anyEntity(TestEntityC)).toEqual(expected);
    },
  );

  test.todo('changing the type of the entity throughout works.', () => {
    // GIVEN / WHEN
    service.apply('testentityC-0', {
      $type: 'TestEntityA',
    });
    service.apply('testentityC-0', {
      $type: 'TestEntityC',
      volatileNumber: 42,
    });

    // THEN
    const expected = new TestEntityC(0);
    expected.volatileNumber = 42;

    expect(service.anyEntity(TestEntityC)).toEqual(expected);
  });

  test.todo('can be spawned for an abstract class.', () => {
    // GIVEN / WHEN
    service.apply('TestAbstractEntity-1', {
      $type: 'TestAbstractEntity',
    });

    // THEN
    expect(service.anyEntity(TestAbstractEntity)).toBeDefined();
  });
});
