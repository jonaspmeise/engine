/// <reference lib="dom" />
import { describe, test, expect } from 'bun:test';
import { entityId } from '@my-engine/library';
import { resolveParams } from './multiplayer-session';

describe('resolveParams', () => {
  test('a plain entity-reference string is resolved to an entity stub', () => {
    // GIVEN / WHEN
    const result = resolveParams('$ENGINE:some-id');

    // THEN
    expect(result).toEqual({ [entityId]: 'some-id' });
  });

  test('a non-entity string passes through unchanged', () => {
    expect(resolveParams('hello')).toBe('hello');
  });

  test('a primitive number passes through unchanged', () => {
    expect(resolveParams(42)).toBe(42);
  });

  test('null passes through unchanged', () => {
    expect(resolveParams(null)).toBeNull();
  });

  test('undefined passes through unchanged', () => {
    expect(resolveParams(undefined)).toBeUndefined();
  });

  test('a plain object with entity-reference values resolves each value', () => {
    // GIVEN
    const input = { target: '$ENGINE:entity-1' };

    // WHEN
    const result = resolveParams(input) as Record<string, unknown>;

    // THEN
    expect(result['target']).toEqual({ [entityId]: 'entity-1' });
  });

  test('an array of entity-reference strings is resolved as an ARRAY, not an object', () => {
    // GIVEN — this is the core bug: arrays must stay arrays after round-trip
    const input = ['$ENGINE:entity-1', '$ENGINE:entity-2'];

    // WHEN
    const result = resolveParams(input);

    // THEN
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([
      { [entityId]: 'entity-1' },
      { [entityId]: 'entity-2' },
    ]);
  });

  test('an array nested inside an object parameter is preserved as an array', () => {
    // GIVEN
    const input = { targets: ['$ENGINE:entity-a', '$ENGINE:entity-b'] };

    // WHEN
    const result = resolveParams(input) as Record<string, unknown>;

    // THEN
    expect(Array.isArray(result['targets'])).toBe(true);
    expect(result['targets']).toEqual([
      { [entityId]: 'entity-a' },
      { [entityId]: 'entity-b' },
    ]);
  });

  test('a nested array of non-entity values passes through as an array', () => {
    // GIVEN
    const input = { tags: ['fire', 'water'] };

    // WHEN
    const result = resolveParams(input) as Record<string, unknown>;

    // THEN
    expect(Array.isArray(result['tags'])).toBe(true);
    expect(result['tags']).toEqual(['fire', 'water']);
  });

  test('a nested object inside an array is resolved recursively', () => {
    // GIVEN
    const input = [{ ref: '$ENGINE:nested-id' }];

    // WHEN
    const result = resolveParams(input) as Array<Record<string, unknown>>;

    // THEN
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]!['ref']).toEqual({ [entityId]: 'nested-id' });
  });
});
