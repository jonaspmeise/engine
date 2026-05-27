import { describe, test, expect } from 'bun:test';
import { Entity } from '../components/entity';
import { Graph } from '../components/graph/graph';
import { jsonRoundtrip, timeout } from '../utility.spec';
import {
  TestGame,
  TestEntityC,
  TestPlayerEntity,
  MutateAndNestAction,
  DeepNestAction,
} from './game.spec.types';

describe('nested actions', () => {
  test('a nested execute is delivered to the client before the parent mutation.', (done) => {
    // GIVEN
    const emitted: Array<Record<string, { volatileNumber?: number }>> = [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestPlayerEntity(1),
          new TestEntityC(1),
          new TestEntityC(2),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN: parent mutates c1 -> 5, then nested-executes (c2 -> 9).
            await runtime.execute(
              new MutateAndNestAction({
                selfId: 'testentityC-1',
                mutateBefore: 5,
                nest: [{ id: 'testentityC-2', value: 9 }],
              }),
            );

            setTimeout(() => {
              // THEN: both the parent and nested mutations reach the client.
              const flat = emitted.flatMap((snapshot) =>
                Object.entries(snapshot).map(
                  ([id, e]) =>
                    [id, e?.volatileNumber] as [string, number | undefined],
                ),
              );

              expect(flat).toContainEqual(['testentityC-1', 5]);
              expect(flat).toContainEqual(['testentityC-2', 9]);

              // The nested mutation must be ordered before the parent.
              const parentIdx = flat.findIndex(
                ([id]) => id === 'testentityC-1',
              );
              const nestedIdx = flat.findIndex(
                ([id]) => id === 'testentityC-2',
              );
              expect(nestedIdx).toBeLessThan(parentIdx);

              done();
            }, 5);
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: (snapshots) => {
          for (const snapshot of snapshots) {
            // The initial state is not relevant to this test.
            if (!initialSeen) {
              initialSeen = true;
              continue;
            }
            emitted.push(jsonRoundtrip(snapshot.dirtyEntities));
          }
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('multiple sequential nested executes are each delivered before the parent mutation.', (done) => {
    // GIVEN
    const emitted: Array<Record<string, { volatileNumber?: number }>> = [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestPlayerEntity(1),
          new TestEntityC(1),
          new TestEntityC(2),
          new TestEntityC(3),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN: parent mutates c1 -> 1, then nested-executes (c2 -> 2) and (c3 -> 3).
            await runtime.execute(
              new MutateAndNestAction({
                selfId: 'testentityC-1',
                mutateBefore: 1,
                nest: [
                  { id: 'testentityC-2', value: 2 },
                  { id: 'testentityC-3', value: 3 },
                ],
              }),
            );

            setTimeout(() => {
              // THEN: all three mutations reach the client, nested siblings in sequential order before their parent.
              const flat = emitted.flatMap((snapshot) =>
                Object.entries(snapshot).map(
                  ([id, e]) =>
                    [id, e?.volatileNumber] as [string, number | undefined],
                ),
              );

              expect(flat).toContainEqual(['testentityC-1', 1]);
              expect(flat).toContainEqual(['testentityC-2', 2]);
              expect(flat).toContainEqual(['testentityC-3', 3]);

              // Nested siblings are delivered in sequential order, before their parent.
              const idxC1 = flat.findIndex(([id]) => id === 'testentityC-1');
              const idxC2 = flat.findIndex(([id]) => id === 'testentityC-2');
              const idxC3 = flat.findIndex(([id]) => id === 'testentityC-3');
              expect(idxC2).toBeLessThan(idxC3);
              expect(idxC3).toBeLessThan(idxC1);

              done();
            }, 5);
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: (snapshots) => {
          for (const snapshot of snapshots) {
            // The initial state is not relevant to this test.
            if (!initialSeen) {
              initialSeen = true;
              continue;
            }
            emitted.push(jsonRoundtrip(snapshot.dirtyEntities));
          }
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('a nested execute that itself nests is delivered deepest-first up to the outermost parent.', (done) => {
    // GIVEN
    const emitted: Array<Record<string, { volatileNumber?: number }>> = [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestPlayerEntity(1),
          new TestEntityC(1),
          new TestEntityC(2),
          new TestEntityC(3),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN: outer mutates c1 -> 1, nested mutates c2 -> 2 then itself nests (c3 -> 3).
            await runtime.execute(
              new DeepNestAction({
                selfId: 'testentityC-1',
                mutateBefore: 1,
                child: {
                  selfId: 'testentityC-2',
                  mutateBefore: 2,
                  nest: [{ id: 'testentityC-3', value: 3 }],
                },
              }),
            );

            setTimeout(() => {
              // THEN: all three levels reach the client deepest-first.
              const flat = emitted.flatMap((snapshot) =>
                Object.entries(snapshot).map(
                  ([id, e]) =>
                    [id, e?.volatileNumber] as [string, number | undefined],
                ),
              );

              expect(flat).toContainEqual(['testentityC-1', 1]);
              expect(flat).toContainEqual(['testentityC-2', 2]);
              expect(flat).toContainEqual(['testentityC-3', 3]);

              const idxC1 = flat.findIndex(([id]) => id === 'testentityC-1');
              const idxC2 = flat.findIndex(([id]) => id === 'testentityC-2');
              const idxC3 = flat.findIndex(([id]) => id === 'testentityC-3');
              expect(idxC3).toBeLessThan(idxC2);
              expect(idxC2).toBeLessThan(idxC1);

              done();
            }, 5);
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: (snapshots) => {
          for (const snapshot of snapshots) {
            if (!initialSeen) {
              initialSeen = true;
              continue;
            }
            emitted.push(jsonRoundtrip(snapshot.dirtyEntities));
          }
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('a mutation made after the nested execute also reaches the client.', (done) => {
    // GIVEN
    const emitted: Array<Record<string, { volatileNumber?: number }>> = [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestPlayerEntity(1),
          new TestEntityC(1),
          new TestEntityC(2),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN: parent nested-executes (c2 -> 9), then mutates c1 -> 7 afterwards.
            await runtime.execute(
              new MutateAndNestAction({
                selfId: 'testentityC-1',
                mutateAfter: 7,
                nest: [{ id: 'testentityC-2', value: 9 }],
              }),
            );

            setTimeout(() => {
              // THEN: both the nested mutation and the post-nest parent mutation reach the client.
              const flat = emitted.flatMap((snapshot) =>
                Object.entries(snapshot).map(
                  ([id, e]) =>
                    [id, e?.volatileNumber] as [string, number | undefined],
                ),
              );

              expect(flat[1]).toEqual(['testentityC-1', 7]);
              expect(flat[0]).toEqual(['testentityC-2', 9]);

              done();
            }, 5);
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: (snapshots) => {
          for (const snapshot of snapshots) {
            if (!initialSeen) {
              initialSeen = true;
              continue;
            }
            emitted.push(jsonRoundtrip(snapshot.dirtyEntities));
          }
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('each action type is recorded in its own snapshot, with nested children ordered before their parent.', (done) => {
    // GIVEN
    const executedTypes: string[] = [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestPlayerEntity(1),
          new TestEntityC(1),
          new TestEntityC(2),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN: parent mutates c1 -> 5, then nested-executes (c2 -> 9).
            await runtime.execute(
              new MutateAndNestAction({
                selfId: 'testentityC-1',
                mutateBefore: 5,
                nest: [{ id: 'testentityC-2', value: 9 }],
              }),
            );

            setTimeout(() => {
              // THEN: both the parent and nested action types are recorded, nested first.
              expect(executedTypes).toContain('MutateAndNestAction');
              expect(executedTypes).toContain('SetValueAction');
              expect(executedTypes.indexOf('SetValueAction')).toBeLessThan(
                executedTypes.indexOf('MutateAndNestAction'),
              );

              done();
            }, 5);
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: (snapshots) => {
          for (const snapshot of snapshots) {
            if (!initialSeen) {
              initialSeen = true;
              continue;
            }
            if (snapshot.executed !== undefined) {
              executedTypes.push(snapshot.executed.$type);
            }
          }
        },
      })
      .catch(done);

    timeout(done, 50);
  });
});
