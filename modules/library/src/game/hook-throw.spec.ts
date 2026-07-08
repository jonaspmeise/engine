import { describe, test, expect } from 'bun:test';
import { Entity } from '../components/entity';
import { Graph } from '../components/graph/graph';
import { ModifiableRuntime } from './modifiable-runtime';
import { AfterAction, BeforeAction } from '../components/lifecyclehooks';
import { timeout } from '../utility.spec';
import {
  TestGame,
  TestEntityC,
  TestPlayerEntity,
  TestAction,
  ParameterizedTestAction,
} from './game.spec.types';

/**
 * Hook invocation in game.ts wraps every before-/after-/after-any hook call in a
 * try/finally that stamps `_triggerSources` before the hook and restores the
 * previous value afterwards. The finally has NO catch — a throwing hook still
 * propagates to the `execute()` call site — but the finally GUARANTEES that the
 * trigger-source stack is restored to its prior value even when the hook throws.
 *
 * Without that finally, a throwing hook leaves `_triggerSources` pointing at the
 * throwing entity's chain, so the NEXT action executed after the caller catches
 * the error is mis-attributed (its source is polluted with the throwing entity).
 *
 * These tests drive a REAL action execution and assert the ACTUAL guarantee:
 *  - the throw propagates (it is not silently swallowed),
 *  - before-throw: the action does NOT apply; after-throw: the action DID apply,
 *  - in BOTH cases `_triggerSources` is restored — observed via a subsequent
 *    action whose triggered prompt carries a CLEAN source (only its own trigger),
 *    never the throwing entity's id.
 */
describe('hook throws — execution continuation & trigger-source restoration', () => {
  // Fires after ParameterizedTestAction and prompts, so the source stamped onto
  // the offered choice reveals `_triggerSources` at the time of a FRESH action
  // executed AFTER a throwing hook was caught.
  class SourceProbe
    extends Entity
    implements AfterAction<ParameterizedTestAction>
  {
    public $type = 'SourceProbe';
    public toString() {
      return 'SourceProbe';
    }
    async afterParameterizedTestAction(
      runtime: ModifiableRuntime,
    ): Promise<void> {
      await runtime.prompt(runtime.players()[0]!, [
        new ParameterizedTestAction({ value: 7 }),
      ]);
    }
  }

  test('a throwing before-hook propagates, does not apply the action, and the finally restores _triggerSources for the next action.', (done) => {
    class BeforeThrower extends Entity implements BeforeAction<TestAction> {
      public $type = 'BeforeThrower';
      public toString() {
        return 'BeforeThrower';
      }
      async beforeTestAction(_runtime: ModifiableRuntime): Promise<void> {
        throw new Error('boom-before');
      }
    }

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new BeforeThrower('before-thrower'),
          new SourceProbe('probe'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            const target = runtime.anyEntity<TestEntityC>(TestEntityC)!;
            const before = target.volatileNumber;

            // WHEN — a before-hook throws mid-execution.
            let caught: unknown = undefined;
            try {
              await runtime.execute(new TestAction());
            } catch (error) {
              caught = error;
            }

            // THEN — the throw was NOT swallowed by the engine's finally...
            expect(caught).toBeInstanceOf(Error);
            expect((caught as Error).message).toBe('boom-before');
            // ...and the prevented-before action never applied.
            expect(target.volatileNumber).toBe(before);

            // A FRESH action now proves _triggerSources was restored: its
            // triggered prompt must carry ONLY the probe's id, never the thrower.
            await runtime.execute(new ParameterizedTestAction({ value: 5 }));
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: (choices, execute) => {
          expect(choices[0]!.execution.source).toEqual(['probe']);
          execute(choices[0]!);
          done();
        },
      })
      .catch(done);

    timeout(done, 100);
  });

  test('a throwing after-hook propagates, still applies the action, and the finally restores _triggerSources for the next action.', (done) => {
    class AfterThrower extends Entity implements AfterAction<TestAction> {
      public $type = 'AfterThrower';
      public toString() {
        return 'AfterThrower';
      }
      async afterTestAction(_runtime: ModifiableRuntime): Promise<void> {
        throw new Error('boom-after');
      }
    }

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new AfterThrower('after-thrower'),
          new SourceProbe('probe'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            const target = runtime.anyEntity<TestEntityC>(TestEntityC)!;
            const before = target.volatileNumber;

            // WHEN — an after-hook throws AFTER the action has been applied.
            let caught: unknown = undefined;
            try {
              await runtime.execute(new TestAction());
            } catch (error) {
              caught = error;
            }

            // THEN — the throw propagated (not swallowed)...
            expect(caught).toBeInstanceOf(Error);
            expect((caught as Error).message).toBe('boom-after');
            // ...but the action itself DID apply before the after-hook ran.
            expect(target.volatileNumber).toBe(before + 1);

            // A FRESH action proves _triggerSources was restored despite the throw.
            await runtime.execute(new ParameterizedTestAction({ value: 5 }));
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: (choices, execute) => {
          expect(choices[0]!.execution.source).toEqual(['probe']);
          execute(choices[0]!);
          done();
        },
      })
      .catch(done);

    timeout(done, 100);
  });
});
