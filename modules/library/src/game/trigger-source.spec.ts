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
import { Action } from '../components/action';

describe('trigger source', () => {
  test('an action executed directly has an empty source array.', (done) => {
    // GIVEN
    const rootAction = new TestAction();

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([new TestEntityC(1), new TestPlayerEntity(1)]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN
            await runtime.execute(rootAction);

            setTimeout(() => {
              // THEN
              expect(rootAction.source).toEqual([]);
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
        state: () => {},
      })
      .catch(done);

    timeout(done, 50);
  });

  test('a choice prompted from a trigger carries the triggering entity ID as its sole source.', (done) => {
    // GIVEN
    class TriggerEntity extends Entity implements AfterAction<TestAction> {
      public $type = 'TriggerEntity';
      public toString() {
        return 'TriggerEntity';
      }
      async afterTestAction(runtime: ModifiableRuntime): Promise<void> {
        // Present a choice to the player; the player interface receives the
        // source already stamped onto the choice's execution object.
        await runtime.prompt(runtime.players()[0]!, [
          new ParameterizedTestAction({ value: 99 }),
        ]);
      }
    }

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new TriggerEntity('trigger-entity'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            await runtime.execute(new TestAction());
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: (choices, execute) => {
          // THEN: the choice offered by the trigger carries the triggering entity's ID.
          expect(choices[0]!.execution.source).toEqual(['trigger-entity']);
          execute(choices[0]!);
          done();
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('multiple choices prompted by the same trigger each carry a source of length 1.', (done) => {
    // GIVEN
    class TriggerEntity extends Entity implements AfterAction<TestAction> {
      public $type = 'TriggerEntity';
      public toString() {
        return 'TriggerEntity';
      }
      async afterTestAction(runtime: ModifiableRuntime): Promise<void> {
        await runtime.prompt(runtime.players()[0]!, [
          new ParameterizedTestAction({ value: 1 }),
          new ParameterizedTestAction({ value: 2 }),
        ]);
      }
    }

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new TriggerEntity('trigger-entity'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            await runtime.execute(new TestAction());
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: (choices, execute) => {
          // THEN: every choice in the prompt carries the single triggering entity's ID.
          expect(choices[0]!.execution.source).toEqual(['trigger-entity']);
          expect(choices[1]!.execution.source).toEqual(['trigger-entity']);
          execute(choices[0]!);
          done();
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('a choice prompted from a chained trigger accumulates all triggering entity IDs in the source array.', (done) => {
    // GIVEN

    // A leaf action with no registered hooks so it cannot start another trigger chain.
    class LeafAction extends Action<'LeafAction'> {
      public $type: 'LeafAction' = 'LeafAction';
      async doApply(): Promise<void> {}
    }

    // EntityE fires after TestAction and executes a ParameterizedTestAction.
    class EntityE extends Entity implements AfterAction<TestAction> {
      public $type = 'EntityE';
      public toString() {
        return 'EntityE';
      }
      async afterTestAction(runtime: ModifiableRuntime): Promise<void> {
        await runtime.execute(new ParameterizedTestAction({ value: 1 }));
      }
    }

    // EntityF fires after ParameterizedTestAction and PROMPTS the player with a LeafAction.
    class EntityF
      extends Entity
      implements AfterAction<ParameterizedTestAction>
    {
      public $type = 'EntityF';
      public toString() {
        return 'EntityF';
      }
      async afterParameterizedTestAction(
        runtime: ModifiableRuntime,
      ): Promise<void> {
        await runtime.prompt(runtime.players()[0]!, [new LeafAction()]);
      }
    }

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new EntityE('entity-e'),
          new EntityF('entity-f'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            await runtime.execute(new TestAction());
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: (choices, execute) => {
          // THEN: the choice was offered by EntityF, which was triggered by EntityE.
          expect(choices[0]!.execution.source).toEqual([
            'entity-e',
            'entity-f',
          ]);
          execute(choices[0]!);
          done();
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('an entity with both a before and an after hook for the same action produces prompted choices with the correct source from each hook.', (done) => {
    // GIVEN: entity B fires both before and after TestAction, and each hook prompts the player.
    class EntityB
      extends Entity
      implements BeforeAction<TestAction>, AfterAction<TestAction>
    {
      public $type = 'EntityB';
      public toString() {
        return 'EntityB';
      }
      async beforeTestAction(runtime: ModifiableRuntime): Promise<void> {
        await runtime.prompt(runtime.players()[0]!, [
          new ParameterizedTestAction({ value: 1 }),
        ]);
      }
      async afterTestAction(runtime: ModifiableRuntime): Promise<void> {
        await runtime.prompt(runtime.players()[0]!, [
          new ParameterizedTestAction({ value: 2 }),
        ]);
      }
    }

    let promptCount = 0;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new EntityB('entity-b'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            await runtime.execute(new TestAction());
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: (choices, execute) => {
          // THEN: regardless of whether this is the before-hook or after-hook prompt,
          // the sole source is always entity B.
          expect(choices[0]!.execution.source).toEqual(['entity-b']);
          execute(choices[0]!);
          promptCount++;
          if (promptCount === 2) done();
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('an entity observing action A via before and after hooks correctly sources choices prompted when action A issues action C in its doApply.', (done) => {
    // GIVEN:
    // ActionA's doApply executes ParameterizedTestAction (action C).
    // EntityB has empty before/after hooks for ActionA (it "observes" A),
    // and an after-hook for ParameterizedTestAction that prompts with two choices.
    //
    // Chain: execute(ActionA)
    //   → EntityB.beforeActionA fires (no-op)
    //   → ActionA.doApply → execute(ParameterizedTestAction)   [_triggerSources is null here]
    //       → EntityB.afterParameterizedTestAction fires
    //           → prompts with [P1, P2], both get source ['entity-b']
    //   → EntityB.afterActionA fires (no-op)
    //
    // Entity B's before/after hooks for A must not corrupt the source tracking
    // for its hook on C.

    class ActionA extends Action<'ActionA'> {
      public $type: 'ActionA' = 'ActionA';
      async doApply(runtime: ModifiableRuntime): Promise<void> {
        await runtime.execute(new ParameterizedTestAction({ value: 0 }));
      }
    }

    class EntityB
      extends Entity
      implements
        BeforeAction<ActionA>,
        AfterAction<ActionA>,
        AfterAction<ParameterizedTestAction>
    {
      public $type = 'EntityB';
      public toString() {
        return 'EntityB';
      }
      // These hooks exist to verify they do not interfere with source tracking.
      async beforeActionA(_runtime: ModifiableRuntime): Promise<void> {}
      async afterActionA(_runtime: ModifiableRuntime): Promise<void> {}
      async afterParameterizedTestAction(
        runtime: ModifiableRuntime,
      ): Promise<void> {
        await runtime.prompt(runtime.players()[0]!, [
          new ParameterizedTestAction({ value: 1 }),
          new ParameterizedTestAction({ value: 2 }),
        ]);
      }
    }

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new EntityB('entity-b'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            await runtime.execute(new ActionA());
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: (choices, execute) => {
          // THEN: ParameterizedTestAction was issued by ActionA.doApply (not from
          // within a hook), so its source is []. EntityB's after-PA hook then stamps
          // both offered choices with ['entity-b'].
          expect(choices[0]!.execution.source).toEqual(['entity-b']);
          expect(choices[1]!.execution.source).toEqual(['entity-b']);
          execute(choices[0]!);
          done();
        },
      })
      .catch(done);

    timeout(done, 50);
  });

  test('the snapshot delivered to the client via the state callback carries the source field of the triggered action.', (done) => {
    // GIVEN: TriggerEntity fires after TestAction and executes ParameterizedTestAction.
    // The snapshot for ParameterizedTestAction must reach the client with source set,
    // so client-side replay logic can reconstruct the trigger chain without extra metadata.
    class TriggerEntity extends Entity implements AfterAction<TestAction> {
      public $type = 'TriggerEntity';
      public toString() {
        return 'TriggerEntity';
      }
      async afterTestAction(runtime: ModifiableRuntime): Promise<void> {
        await runtime.execute(new ParameterizedTestAction({ value: 42 }));
      }
    }

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([
          new TestEntityC(1),
          new TestPlayerEntity(1),
          new TriggerEntity('trigger-entity'),
        ]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            await runtime.execute(new TestAction());
          },
        };
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: (snapshots) => {
          // The state callback may be invoked multiple times. We are interested in
          // whichever batch contains the ParameterizedTestAction snapshot.
          const triggered = snapshots.find(
            (s) => s.executed?.$type === 'ParameterizedTestAction',
          );
          if (triggered === undefined) return;

          // THEN: the snapshot carries the full source chain so the client can
          // replay or attribute the action without additional side-channel data.
          expect(triggered.executed!.source).toEqual(['trigger-entity']);
          done();
        },
      })
      .catch(done);

    timeout(done, 50);
  });
});
