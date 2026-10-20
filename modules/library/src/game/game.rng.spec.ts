import { describe, test, expect } from 'bun:test';
import { NO_OP_LOGGER } from './game.types';
import { TestGame } from './game.spec.types';

const silent = { logger: NO_OP_LOGGER };

describe('Game RNG', () => {
  test('omitted seed still exposes a resolved game.seed', () => {
    const game = new TestGame(undefined, silent);
    expect(typeof game.seed).toBe('number');
  });

  test('same seed yields the same random() sequence', () => {
    const a = new TestGame(undefined, { ...silent, seed: 42 });
    const b = new TestGame(undefined, { ...silent, seed: 42 });
    expect(a.random()).toBe(b.random());
    expect(a.randomInt(10)).toBe(b.randomInt(10));
  });

  test('clone copies RNG state, not the original seed position', () => {
    const game = new TestGame(undefined, { ...silent, seed: 7 });
    game.random();
    const clone = game.clone();
    expect(clone.random()).toBe(game.random());
  });
});
