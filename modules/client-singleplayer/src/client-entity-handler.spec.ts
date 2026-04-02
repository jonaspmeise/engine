/// <reference lib="dom" />
import { describe, test, mock, beforeEach, jest, expect } from 'bun:test';
import { Entity, entityId } from '@my-engine/library';
import { ClientEntityHandler } from './client-entity-handler';
import { ClientEntity } from './client-entity-handler.types';
import { TestEntityA } from '../../library/src/game.spec.types';

const animate = mock(() => Promise.resolve());
const render = mock(() => {});
const element: HTMLElement = document.createElement('div');

describe('Client Entity Handler', () => {
  let service: ClientEntityHandler;

  beforeEach(() => {
    service = new ClientEntityHandler(
      {
        TestEntityA: TestEntityA,
      },
      console,
    );
    jest.clearAllMocks();
  });

  test('an applied entity delta creates the entity in the service', () => {
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
    };

    expect(service.anyEntity(Entity)).toEqual(expected);
    expect(service.entities(Entity)).toEqual([expected]);
    expect(service.entitySet(Entity)).toEqual(new Set([expected]));
    expect(service.players()).toEqual([]);
  });

  test('an applied entity delta modifies an existing entity in the service', () => {
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
    };

    expect(service.anyEntity(Entity)).toEqual(expected);
    expect(service.entities(Entity)).toEqual([expected]);
    expect(service.entitySet(Entity)).toEqual(new Set([expected]));
    expect(service.players()).toEqual([]);
  });

  test('throws an error if the delta contains an unknown entity type', async () => {
    // GIVEN / WHEN
    expect(() =>
      service.apply('test-id', {
        $type: 'UnknownEntity',
        name: 'Modified Name',
      }),
    ).toThrow('Unknown entity type: UnknownEntity');
  });
});
