import { describe, test, expect } from 'bun:test';
import { Entity, entityId } from '../components/entity';
import { Graph } from '../components/graph/graph';
import { ModifiableRuntime } from './modifiable-runtime';
import { QueryableRuntime } from './queryable-runtime';
import { Action } from '../components/action';
import { AfterAction, BeforeAction } from '../components/lifecyclehooks';
import { jsonRoundtrip, timeout } from '../utility.spec';
import {
  TestGame,
  TestEntityC,
  TestPlayerEntity,
  TestAction,
} from './game.spec.types';

/** A leaf action that sets c4's volatileNumber, used by the nested-after-hook sanity test. */
class NestedSetAction extends Action<'NestedSetAction', { value: number }> {
  public $type: 'NestedSetAction' = 'NestedSetAction';
  async doApply(runtime: QueryableRuntime): Promise<void> {
    runtime
      .entities(TestEntityC)
      .find((e) => e[entityId] === 'testentityC-4')!.volatileNumber =
      this.parameters.value;
  }
}

/**
 * C4 coverage: direct mutations made in a top-level action's BEFORE/AFTER hooks
 * (including spawnEntity in an after-hook) must reach the client. Previously the
 * batching model swallowed these: before-hook mutations landed in the already-
 * emitted (about-to-be-archived) prior batch, and after-hook mutations appended
 * to a batch whose emitted-count had already been advanced. Only nested
 * `runtime.execute(...)` mutations reached clients.
 *
 * Each test observes the raw state callback (registerPlayerCallback) and flattens
 * every emitted snapshot's dirtyEntities, mirroring the nested-action /
 * collection-mutation client-delivery specs.
 */
describe('direct hook mutations reach the client (C4)', () => {
  test('a direct property mutation made in a top-level action BEFORE-hook reaches the client.', (done) => {
    // GIVEN — an entity whose before-hook directly mutates another entity.
    class BeforeMutator extends Entity implements BeforeAction<TestAction> {
      public $type = 'BeforeMutator';
      public toString() {
        return 'BeforeMutator';
      }
      beforeTestAction(runtime: ModifiableRuntime): void {
        runtime
          .entities(TestEntityC)
          .find((e) => e[entityId] === 'testentityC-2')!.volatileNumber = 5;
      }
    }

    const emitted: Array<Record<string, { volatileNumber?: number }>> = [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestPlayerEntity(1),
          new TestEntityC(1),
          new TestEntityC(2),
          new BeforeMutator('before-mutator'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN — a top-level action fires; its before-hook mutates c2 -> 5.
            await runtime.execute(new TestAction());

            setTimeout(() => {
              // THEN — the before-hook's direct mutation reached the client.
              const flat = emitted.flatMap((snapshot) =>
                Object.entries(snapshot).map(
                  ([id, e]) =>
                    [id, e?.volatileNumber] as [string, number | undefined],
                ),
              );
              expect(flat).toContainEqual(['testentityC-2', 5]);
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

  test('a direct mutation AND a spawnEntity made in a top-level action AFTER-hook both reach the client.', (done) => {
    // GIVEN — an entity whose after-hook directly mutates AND spawns a new entity.
    class AfterMutatorSpawner extends Entity implements AfterAction<TestAction> {
      public $type = 'AfterMutatorSpawner';
      public toString() {
        return 'AfterMutatorSpawner';
      }
      afterTestAction(runtime: ModifiableRuntime): void {
        runtime
          .entities(TestEntityC)
          .find((e) => e[entityId] === 'testentityC-3')!.volatileNumber = 7;
        runtime.spawnEntity(new TestEntityC(9));
      }
    }

    const emitted: Array<Record<string, { volatileNumber?: number } | null>> =
      [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestPlayerEntity(1),
          new TestEntityC(1),
          new TestEntityC(3),
          new AfterMutatorSpawner('after-mutator-spawner'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN — a top-level action fires; its after-hook mutates c3 -> 7 and spawns c9.
            await runtime.execute(new TestAction());

            setTimeout(() => {
              // THEN — both the direct mutation and the spawn reached the client.
              const flat = emitted.flatMap((snapshot) =>
                Object.entries(snapshot).map(
                  ([id, e]) =>
                    [id, e?.volatileNumber] as [string, number | undefined],
                ),
              );
              expect(flat).toContainEqual(['testentityC-3', 7]);
              expect(flat.map(([id]) => id)).toContain('testentityC-9');
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

  test('a nested-execute mutation from an after-hook is still delivered exactly once (no duplicate).', (done) => {
    // GIVEN — an after-hook that mutates via a nested execute (the working path).
    class NestedAfterExecutor extends Entity implements AfterAction<TestAction> {
      public $type = 'NestedAfterExecutor';
      public toString() {
        return 'NestedAfterExecutor';
      }
      async afterTestAction(runtime: ModifiableRuntime): Promise<void> {
        await runtime.execute(new NestedSetAction({ value: 9 }));
      }
    }

    const emitted: Array<Record<string, { volatileNumber?: number }>> = [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestPlayerEntity(1),
          new TestEntityC(1),
          new TestEntityC(4),
          new NestedAfterExecutor('nested-after-executor'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN — the after-hook nested-executes a mutation of c4 -> 9.
            await runtime.execute(new TestAction());

            setTimeout(() => {
              // THEN — the nested mutation is delivered exactly once (delta count).
              const occurrences = emitted
                .flatMap((snapshot) => Object.entries(snapshot))
                .filter(
                  ([id, e]) =>
                    id === 'testentityC-4' && e?.volatileNumber === 9,
                );
              expect(occurrences).toHaveLength(1);
              done();
            }, 5);
          },
        };
      }

      actionClasses() {
        return new Set([...super.actionClasses(), NestedSetAction]);
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
});
