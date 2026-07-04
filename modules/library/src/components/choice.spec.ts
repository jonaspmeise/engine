import { describe, test, expect } from 'bun:test';
import { Action } from './action';
import { Entity, entityId } from './entity';
import { EnhancedChoice } from './choice';
import type { PlayerEntity } from '../services/entity/entity-service.types';

// Expose the protected static for testing via a subclass.
class TestableChoice extends EnhancedChoice<Action<string, any>> {
  static dereference(obj: unknown): unknown {
    return EnhancedChoice.dereferenceEntity(obj as Record<string, unknown>);
  }
}

class DummyEntity extends Entity {
  public $type = 'DummyEntity';
  constructor(id: string) {
    super(id);
  }
  public toString() {
    return `DummyEntity(${this[entityId]})`;
  }
}

describe('EnhancedChoice.dereferenceEntity', () => {
  test('an array of entities is serialized as an array, not an object', () => {
    // GIVEN
    const a = new DummyEntity('entity-a');
    const b = new DummyEntity('entity-b');

    // WHEN
    const result = TestableChoice.dereference({ targets: [a, b] }) as Record<
      string,
      unknown
    >;

    // THEN — must be an array, not {"0": ..., "1": ...}
    expect(Array.isArray(result['targets'])).toBe(true);
    expect(result['targets']).toEqual(['$ENGINE:entity-a', '$ENGINE:entity-b']);
  });

  test('a nested array of entities is preserved', () => {
    // GIVEN
    const a = new DummyEntity('entity-a');

    // WHEN
    const result = TestableChoice.dereference({
      nested: { items: [a] },
    }) as Record<string, Record<string, unknown>>;

    // THEN
    expect(Array.isArray(result['nested']!['items'])).toBe(true);
    expect(result['nested']!['items']).toEqual(['$ENGINE:entity-a']);
  });

  test('an array of non-entity values passes through as an array', () => {
    // GIVEN / WHEN
    const result = TestableChoice.dereference({
      tags: ['fire', 'water', 'earth'],
    }) as Record<string, unknown>;

    // THEN
    expect(Array.isArray(result['tags'])).toBe(true);
    expect(result['tags']).toEqual(['fire', 'water', 'earth']);
  });

  test('a nested array of plain objects is preserved', () => {
    // GIVEN / WHEN
    const result = TestableChoice.dereference({
      coords: [{ x: 1 }, { x: 2 }],
    }) as Record<string, unknown>;

    // THEN
    expect(Array.isArray(result['coords'])).toBe(true);
    expect(result['coords']).toEqual([{ x: 1 }, { x: 2 }]);
  });

  test('existing non-array object parameters are still handled correctly', () => {
    // GIVEN
    const entity = new DummyEntity('entity-c');

    // WHEN
    const result = TestableChoice.dereference({
      target: entity,
      nested: { target: entity },
    }) as Record<string, unknown>;

    // THEN (regression: the plain-object path must still work)
    expect(result['target']).toBe('$ENGINE:entity-c');
    expect((result['nested'] as Record<string, unknown>)['target']).toBe(
      '$ENGINE:entity-c',
    );
  });

  test('entity serialized as top-level value is dereferenced', () => {
    // GIVEN
    const entity = new DummyEntity('entity-d');

    // WHEN — entity passed directly as a parameter value (not wrapped in object)
    const result = TestableChoice.dereference({ self: entity }) as Record<
      string,
      unknown
    >;

    // THEN
    expect(result['self']).toBe('$ENGINE:entity-d');
  });

  test('the player reference in toJSON uses the ENGINE prefix', () => {
    // GIVEN — verify EnhancedChoice.toJSON still serializes player correctly
    class DummyAction extends Action<'DummyAction'> {
      public $type: 'DummyAction' = 'DummyAction';
      async doApply(): Promise<void> {}
    }

    const player = new DummyEntity('player-1') as unknown as PlayerEntity;
    const choice = EnhancedChoice.fromAction(new DummyAction(), player, 0);

    // WHEN
    const json = JSON.parse(JSON.stringify(choice)) as {
      player: unknown;
      id: number;
    };

    // THEN
    expect(json['player']).toBe('$ENGINE:player-1');
    expect(json['id']).toBe(0);
  });
});
