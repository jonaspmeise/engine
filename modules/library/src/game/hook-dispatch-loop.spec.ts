import { describe, test, expect } from 'bun:test';
import { Entity } from '../components/entity';
import { Graph } from '../components/graph/graph';
import { ModifiableRuntime } from './modifiable-runtime';
import { AfterAction } from '../components/lifecyclehooks';
import { timeout } from '../utility.spec';
import {
  TestGame,
  TestEntityC,
  TestPlayerEntity,
  TestAction,
} from './game.spec.types';

/**
 * `EntityService.getHook` / `getAfterAnyHooks` return a SNAPSHOT copy of the
 * registered-listener list so that a hook which spawns a new listener for the
 * SAME action mid-dispatch cannot mutate the list the dispatch loop in game.ts
 * is currently iterating.
 *
 * The observable bug the snapshot prevents:
 *  - Without the copy, game.ts iterates the live list. When a hook spawns a new
 *    entity carrying the same hook, `create()` pushes it onto that very list, so
 *    the in-progress for..of visits the freshly-spawned entity too — a DOUBLE
 *    fire within the same action's dispatch (and, symmetrically, a destroy could
 *    SKIP a fellow listener).
 *
 * This test drives a REAL action + after-hook dispatch and asserts the observable
 * contract rather than the internal snapshot identity:
 *  (a) every pre-existing listener fires EXACTLY once (none skipped, none doubled),
 *  (b) the entity spawned during dispatch does NOT fire in the same dispatch, and
 *  (c) it IS picked up on the very next action (proving it was registered, just
 *      deferred — not lost).
 */
describe('hook dispatch loop — spawning a listener mid-dispatch (H4)', () => {
  test('a listener spawned by another listener does not fire in the same dispatch, while pre-existing listeners each fire exactly once.', (done) => {
    let plainFires = 0;
    let spawnedFires = 0;
    let spawnCount = 0;

    // Spawned mid-dispatch by Spawner. Carries the SAME afterTestAction hook.
    class SpawnedListener extends Entity implements AfterAction<TestAction> {
      public $type = 'SpawnedListener';
      constructor(id: string) {
        super(id);
      }
      public toString() {
        return 'SpawnedListener';
      }
      async afterTestAction(_runtime: ModifiableRuntime): Promise<void> {
        spawnedFires++;
      }
    }

    // A pre-existing listener that must fire exactly once per action.
    class PlainListener extends Entity implements AfterAction<TestAction> {
      public $type = 'PlainListener';
      public toString() {
        return 'PlainListener';
      }
      async afterTestAction(_runtime: ModifiableRuntime): Promise<void> {
        plainFires++;
      }
    }

    // A pre-existing listener that spawns exactly one new listener (with the same
    // hook) the first time it fires — the mid-iteration mutation under test.
    class Spawner extends Entity implements AfterAction<TestAction> {
      public $type = 'Spawner';
      public toString() {
        return 'Spawner';
      }
      async afterTestAction(runtime: ModifiableRuntime): Promise<void> {
        if (spawnCount === 0) {
          spawnCount++;
          runtime.spawnEntity(new SpawnedListener('spawned-listener'));
        }
      }
    }

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new Spawner('spawner'),
          new PlainListener('plain'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN — first action fires the two pre-existing after-hooks; the
            // Spawner spawns a third listener mid-dispatch.
            await runtime.execute(new TestAction());

            // Vacuity guard: the spawn must have actually happened, otherwise
            // "spawnedFires === 0" would be trivially true.
            expect(spawnCount).toBe(1);
            expect(runtime.entities(SpawnedListener)).toHaveLength(1);

            // THEN (a) — both pre-existing listeners fired exactly once.
            expect(plainFires).toBe(1);
            // THEN (b) — the listener spawned mid-dispatch did NOT fire this time.
            expect(spawnedFires).toBe(0);

            // WHEN — a second action is executed.
            await runtime.execute(new TestAction());

            // THEN (c) — the previously-spawned listener now fires (deferred, not
            // lost), and the pre-existing listener has fired once more.
            expect(spawnedFires).toBe(1);
            expect(plainFires).toBe(2);

            setTimeout(done, 5);
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: () => {},
      })
      .catch(done);

    timeout(done, 100);
  });
});
