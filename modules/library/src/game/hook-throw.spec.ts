import { describe, test, expect } from 'bun:test';
import { Entity } from '../components/entity';
import { Graph } from '../components/graph/graph';
import { ModifiableRuntime } from './modifiable-runtime';
import {
  AfterAction,
  AfterAnyAction,
  BeforeAction,
} from '../components/lifecyclehooks';
import { Action } from '../components/action';
import { Logger, NO_OP_LOGGER } from './game.types';
import { timeout } from '../utility.spec';
import {
  TestGame,
  TestEntityC,
  TestPlayerEntity,
  TestAction,
  ParameterizedTestAction,
} from './game.spec.types';

/**
 * Hook invocation in game.ts wraps every hook call in a try/finally that stamps
 * `_triggerSources` before the hook and restores the previous value afterwards.
 *
 * BEFORE-hooks (and check-hooks) gate action LEGALITY — they may veto an action.
 * A throw there must keep PROPAGATING so a buggy gate can never silently allow an
 * illegal action. That path is intentionally left un-caught.
 *
 * AFTER- and AFTER-ANY-hooks are pure post-apply triggered abilities: by the time
 * they run the action has already committed. A single buggy ability must not tear
 * down the whole match, so `execute()` now CATCHES a throwing after/after-any hook,
 * LOGS it via the engine logger, and CONTINUES — the action stays applied, the next
 * hook/action still runs, and `_triggerSources` is restored either way.
 *
 * These tests drive REAL action execution via the TestGame harness and inject a
 * capturing logger (instead of NO_OP_LOGGER) so the log-on-throw is observable.
 */
describe('hook throws — after/after-any caught+logged, before still propagates', () => {
  // Builds a logger that behaves as NO_OP except it records every `.error(...)`
  // call, so a test can assert the engine logged a swallowed hook throw.
  const capturingLogger = (): { logger: Logger; errors: unknown[][] } => {
    const errors: unknown[][] = [];
    const logger: Logger = {
      ...NO_OP_LOGGER,
      error: (...message: unknown[]) => {
        errors.push(message);
      },
    };
    return { logger, errors };
  };

  // True when some captured `.error(...)` call carried an Error with this message.
  const loggedError = (errors: unknown[][], message: string): boolean =>
    errors.some((args) =>
      args.some((arg) => arg instanceof Error && arg.message === message),
    );

  // Fires after ParameterizedTestAction and prompts, so the source stamped onto
  // the offered choice reveals `_triggerSources` at the time of a FRESH action
  // executed AFTER a throwing hook was caught (or propagated).
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

  test('a throwing before-hook PROPAGATES, does not apply the action, and the finally restores _triggerSources for the next action.', (done) => {
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

            // THEN — before-hooks gate legality, so the throw is NOT swallowed...
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

    const game = new DummyGame(undefined, { logger: NO_OP_LOGGER });
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

  test('a throwing after-hook is CAUGHT and LOGGED, still applies the action, a subsequent action runs, and _triggerSources is restored.', (done) => {
    class AfterThrower extends Entity implements AfterAction<TestAction> {
      public $type = 'AfterThrower';
      public toString() {
        return 'AfterThrower';
      }
      async afterTestAction(_runtime: ModifiableRuntime): Promise<void> {
        throw new Error('boom-after');
      }
    }

    const { logger, errors } = capturingLogger();

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

            // THEN — the engine SWALLOWS the throw (execute does not reject)...
            // (If the catch were absent this would fail: `caught` would be the Error.)
            expect(caught).toBeUndefined();
            // ...the action itself DID apply before the after-hook ran...
            expect(target.volatileNumber).toBe(before + 1);
            // ...and the swallowed throw was logged via the engine logger.
            expect(loggedError(errors, 'boom-after')).toBe(true);

            // A FRESH action proves the match continues AND _triggerSources was
            // restored: its triggered prompt carries ONLY the probe's id.
            await runtime.execute(new ParameterizedTestAction({ value: 5 }));
          },
        };
      }
    }

    const game = new DummyGame(undefined, { logger });
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

  test('a throwing after-ANY-hook is CAUGHT and LOGGED, computation continues, and _triggerSources is restored.', (done) => {
    class AfterAnyThrower extends Entity implements AfterAnyAction {
      public $type = 'AfterAnyThrower';
      public toString() {
        return 'AfterAnyThrower';
      }
      async after(
        _runtime: ModifiableRuntime,
        _action: Action<string, any, any>,
      ): Promise<void> {
        throw new Error('boom-after-any');
      }
    }

    const { logger, errors } = capturingLogger();

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new AfterAnyThrower('after-any-thrower'),
          new SourceProbe('probe'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            const target = runtime.anyEntity<TestEntityC>(TestEntityC)!;
            const before = target.volatileNumber;

            // WHEN — an after-any hook (fires after EVERY action) throws.
            let caught: unknown = undefined;
            try {
              await runtime.execute(new TestAction());
            } catch (error) {
              caught = error;
            }

            // THEN — the engine SWALLOWS the throw (execute does not reject)...
            // (If the catch were absent this would fail: `caught` would be the Error.)
            expect(caught).toBeUndefined();
            // ...the action itself DID apply...
            expect(target.volatileNumber).toBe(before + 1);
            // ...and the swallowed throw was logged via the engine logger.
            expect(loggedError(errors, 'boom-after-any')).toBe(true);

            // A FRESH action proves the match continues AND _triggerSources was
            // restored: its triggered prompt carries ONLY the probe's id.
            await runtime.execute(new ParameterizedTestAction({ value: 5 }));
          },
        };
      }
    }

    const game = new DummyGame(undefined, { logger });
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
