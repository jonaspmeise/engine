import { describe, test, expect } from 'bun:test';
import { SeededRng } from './seeded-rng';

describe('SeededRng', () => {
  test('same seed produces the same sequence', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const seqA = Array.from({ length: 8 }, () => a.random());
    const seqB = Array.from({ length: 8 }, () => b.random());
    expect(seqA).toEqual(seqB);
  });

  test('different seeds produce different sequences', () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    expect(a.random()).not.toBe(b.random());
  });

  test('randomInt(n) stays in [0, n)', () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 100; i += 1) {
      const value = rng.randomInt(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
    }
  });

  test('clone continues from the current state, not the original seed', () => {
    const parent = new SeededRng(99);
    parent.random();
    parent.random();
    const child = parent.clone();
    expect(child.random()).toBe(parent.random());
  });
});
