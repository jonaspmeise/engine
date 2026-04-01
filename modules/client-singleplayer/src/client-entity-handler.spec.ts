/// <reference lib="dom" />
import { describe, test, mock, beforeEach, jest, expect } from 'bun:test';
import { Client } from './client';
import {
  Entity,
  entityId,
  QueryableRuntime,
  Snapshot,
} from '@my-engine/library';
import { ClientEntityHandler } from './client-entity-handler';
import { ClientEntity } from './client-entity-handler.types';

const animate = mock(() => Promise.resolve());
const render = mock(() => {});
const element: HTMLElement = document.createElement('div');

describe('Client Entity Handler', () => {
  let service: ClientEntityHandler;

  beforeEach(() => {
    service = new ClientEntityHandler();
    jest.clearAllMocks();
  });

  test('an applied entity delta updates the entity in the service', () => {
    // GIVEN
    const delta: Partial<ClientEntity> = {
      $type: 'TestEntity',
      name: 'Test Name',
    };
    const id = 'entity-1';

    // WHEN
    service.apply(id, delta);

    // THEN
    const expected: ClientEntity = {
      [entityId]: id,
      $type: 'TestEntity',
      name: 'Test Name',
    };

    expect(service.anyEntity(Entity)).toEqual(expected);
    expect(service.entities(Entity)).toEqual([expected]);
    expect(service.entitySet(Entity)).toEqual(new Set([expected]));
    expect(service.players()).toEqual([]);
  });
});
