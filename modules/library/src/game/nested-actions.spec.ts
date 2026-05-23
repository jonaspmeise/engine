import { describe, test, expect } from 'bun:test';
import { Entity } from '../components/entity';
import { Action } from '../components/action';
import { Graph } from '../components/graph/graph';
import { jsonRoundtrip } from '../utility.spec';
import {
  TestGame,
  TestEntityC,
  TestPlayerEntity,
  MutateAndNestAction,
  DeepNestAction,
} from './game.spec.types';

/**
 * These tests pin down the "nested-action snapshot swallow" bug:
 *
 * When an action's `doApply` mutates an entity and THEN calls a nested
 * `runtime.execute(...)`, the parent's accumulated mutation must still reach the
 * client in a snapshot — ordered before the nested action's snapshot. Before the
 * fix, the nested execute archived (and silently dropped) the parent's pending
 * snapshot, so the parent mutation never reached the player.
 *
 * Each test drives a single top-level action through the full game pipeline and
 * records, in order, every `dirtyEntities` map emitted to the player across all
 * `state` callbacks. The first emitted snapshot is always the initial setup
 * state and is ignored.
 */
describe('nested actions', () => {
  /**
   * Runs `action` as the single top-level action of a fresh game with the given
   * number of {@link TestEntityC} entities, and resolves with the ordered list
   * of emitted `dirtyEntities` maps (excluding the initial setup snapshot).
   */
  const runAndCollect = (
    action: Action<string, any, any>,
    entityCount: number,
  ): Promise<Array<Record<string, { volatileNumber?: number }>>> => {
    return new Promise((resolve, reject) => {
      const emitted: Array<Record<string, { volatileNumber?: number }>> = [];
      let initialSeen = false;

      class DummyGame extends TestGame {
        initialize(): Set<Entity> {
          const entities = new Set<Entity>([new TestPlayerEntity(1)]);
          for (let i = 1; i <= entityCount; i++) {
            entities.add(new TestEntityC(i));
          }
          return entities;
        }

        rawGraph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              await runtime.execute(action);

              // Give the engine a tick to flush, then resolve.
              setTimeout(() => resolve(emitted), 5);
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
                // The very first emitted snapshot is the setup state.
                initialSeen = true;
                continue;
              }
              emitted.push(jsonRoundtrip(snapshot.dirtyEntities));
            }
          },
        })
        .catch(reject);
    });
  };

  /**
   * Flattens the ordered list of emitted snapshots into an ordered list of
   * [entityId, volatileNumber] tuples, so ordering across snapshots can be
   * asserted regardless of how the engine batches them.
   */
  const flatten = (
    emitted: Array<Record<string, { volatileNumber?: number }>>,
  ): Array<[string, number | undefined]> => {
    const result: Array<[string, number | undefined]> = [];
    for (const map of emitted) {
      for (const [id, entity] of Object.entries(map)) {
        result.push([id, entity?.volatileNumber]);
      }
    }
    return result;
  };

  test('a single nested execute does not swallow the parent mutation made before it.', async () => {
    // GIVEN: parent mutates c1 -> 5, then nested-executes (c2 -> 9).
    const emitted = await runAndCollect(
      new MutateAndNestAction({
        selfId: 'testentityC-1',
        mutateBefore: 5,
        nest: [{ id: 'testentityC-2', value: 9 }],
      }),
      2,
    );

    // THEN: BOTH the parent's mutation and the nested mutation reach the client,
    // with the parent's mutation ordered before the nested one.
    const flat = flatten(emitted);
    expect(flat).toContainEqual(['testentityC-1', 5]);
    expect(flat).toContainEqual(['testentityC-2', 9]);

    const parentIdx = flat.findIndex(([id]) => id === 'testentityC-1');
    const nestedIdx = flat.findIndex(([id]) => id === 'testentityC-2');
    expect(parentIdx).toBeLessThan(nestedIdx);
  });

  test('multiple sequential nested executes each reach the client, after the parent mutation.', async () => {
    // GIVEN: parent mutates c1 -> 1, then nested-executes (c2 -> 2), (c3 -> 3).
    const emitted = await runAndCollect(
      new MutateAndNestAction({
        selfId: 'testentityC-1',
        mutateBefore: 1,
        nest: [
          { id: 'testentityC-2', value: 2 },
          { id: 'testentityC-3', value: 3 },
        ],
      }),
      3,
    );

    // THEN: parent mutation + both nested mutations reach the client, in order.
    const flat = flatten(emitted);
    expect(flat).toContainEqual(['testentityC-1', 1]);
    expect(flat).toContainEqual(['testentityC-2', 2]);
    expect(flat).toContainEqual(['testentityC-3', 3]);

    const idxC1 = flat.findIndex(([id]) => id === 'testentityC-1');
    const idxC2 = flat.findIndex(([id]) => id === 'testentityC-2');
    const idxC3 = flat.findIndex(([id]) => id === 'testentityC-3');
    expect(idxC1).toBeLessThan(idxC2);
    expect(idxC2).toBeLessThan(idxC3);
  });

  test('a nested execute that itself nests preserves every level mutation, in order.', async () => {
    // GIVEN: outer mutates c1 -> 1, nested mutates c2 -> 2 then nests (c3 -> 3).
    const emitted = await runAndCollect(
      new DeepNestAction({
        selfId: 'testentityC-1',
        mutateBefore: 1,
        child: {
          selfId: 'testentityC-2',
          mutateBefore: 2,
          nest: [{ id: 'testentityC-3', value: 3 }],
        },
      }),
      3,
    );

    // THEN: all three levels reach the client in nesting order.
    const flat = flatten(emitted);
    expect(flat).toContainEqual(['testentityC-1', 1]);
    expect(flat).toContainEqual(['testentityC-2', 2]);
    expect(flat).toContainEqual(['testentityC-3', 3]);

    const idxC1 = flat.findIndex(([id]) => id === 'testentityC-1');
    const idxC2 = flat.findIndex(([id]) => id === 'testentityC-2');
    const idxC3 = flat.findIndex(([id]) => id === 'testentityC-3');
    expect(idxC1).toBeLessThan(idxC2);
    expect(idxC2).toBeLessThan(idxC3);
  });

  test('a mutation made AFTER the nested execute also reaches the client.', async () => {
    // GIVEN: parent nested-executes (c2 -> 9), then mutates c1 -> 7 afterwards.
    const emitted = await runAndCollect(
      new MutateAndNestAction({
        selfId: 'testentityC-1',
        mutateAfter: 7,
        nest: [{ id: 'testentityC-2', value: 9 }],
      }),
      2,
    );

    // THEN: both the nested mutation and the post-nest parent mutation reach the
    // client.
    const flat = flatten(emitted);
    expect(flat).toContainEqual(['testentityC-1', 7]);
    expect(flat).toContainEqual(['testentityC-2', 9]);
  });

  test('a parent that mutates both before AND after a nested execute reaches the client with both values.', async () => {
    // GIVEN: parent mutates c1 -> 5, nests (c2 -> 9), then mutates c1 -> 7.
    const emitted = await runAndCollect(
      new MutateAndNestAction({
        selfId: 'testentityC-1',
        mutateBefore: 5,
        mutateAfter: 7,
        nest: [{ id: 'testentityC-2', value: 9 }],
      }),
      2,
    );

    // THEN: the nested mutation reaches the client, and the parent's final value
    // (7) reaches the client too.
    const flat = flatten(emitted);
    expect(flat).toContainEqual(['testentityC-2', 9]);
    // The last emitted value for c1 must be its final value, 7.
    const c1Values = flat
      .filter(([id]) => id === 'testentityC-1')
      .map(([, value]) => value);
    expect(c1Values.length).toBeGreaterThan(0);
    expect(c1Values[c1Values.length - 1]).toBe(7);
  });

  test('the executed action recorded in the parent snapshot is the parent action, not the nested one.', async () => {
    // This guards against a regression where the parent snapshot is overwritten
    // by the nested snapshot (which would mislabel which action caused the
    // parent mutation).
    return new Promise<void>((resolve, reject) => {
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
              await runtime.execute(
                new MutateAndNestAction({
                  selfId: 'testentityC-1',
                  mutateBefore: 5,
                  nest: [{ id: 'testentityC-2', value: 9 }],
                }),
              );
              setTimeout(() => {
                // THEN: both the parent and the nested action are recorded, in
                // order (parent first).
                expect(executedTypes).toContain('MutateAndNestAction');
                expect(executedTypes).toContain('SetValueAction');
                expect(executedTypes.indexOf('MutateAndNestAction')).toBeLessThan(
                  executedTypes.indexOf('SetValueAction'),
                );
                resolve();
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
        .catch(reject);
    });
  });
});
