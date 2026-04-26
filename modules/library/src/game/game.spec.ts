import { jest, describe, test, expect, spyOn, afterEach, mock } from 'bun:test';
import { Action } from '../components/action';
import { ModifiableRuntime } from './modifiable-runtime';
import { Entity, entityId } from '../components/entity';
import { Logger } from './game.types';
import { jsonRoundtrip, timeout } from '../utility.spec';
import {
  TestGame,
  TestEntityA,
  TestPlayerEntity,
  TestEntityB,
  TestEntityC,
  TestAction,
  ParameterizedTestAction,
} from './game.spec.types';
import { NodeId } from '../components/graph/node.types';
import { Graph } from '../components/graph/graph';
import {
  AfterAction,
  BeforeAction,
  CheckAction,
  LifecycleType,
} from '../components/lifecyclehooks';
import { GraphRuntime } from './graph-runtime';

describe('game', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const logger: Logger = {
    log: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  };

  describe('initialize', () => {
    test('throws an error if an entity is registered with an ID that is already taken by another entity.', () => {
      // GIVEN
      spyOn(TestGame.prototype, 'initialize').mockReturnValue(
        new Set([new TestEntityA(1), new TestEntityA(1)]),
      );

      // WHEN / THEN
      expect(() => new TestGame()).toThrowError(/duplicate/gi);
    });

    test('throws an error if the game does not initialize any entities.', () => {
      // GIVEN
      spyOn(TestGame.prototype, 'initialize').mockReturnValueOnce(new Set());

      // WHEN / THEN
      expect(() => new TestGame()).toThrowError(/no entities were spawned/gi);
    });

    test('throws an error if no PlayerInterface-capable entity is spawned. These interfaces are needed to communicate with a player.', () => {
      // GIVEN
      spyOn(TestGame.prototype, 'initialize').mockReturnValueOnce(
        new Set([new TestEntityA(1), new TestEntityA(2)]),
      );

      // WHEN / THEN
      expect(() => new TestGame()).toThrowError(/player/i);
    });

    test('player interfaces are assigned a unique ID upon creation.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      const playerInterfaces = game.entities(TestPlayerEntity);

      expect(playerInterfaces).toHaveLength(2);
      expect(playerInterfaces[0]![entityId]).not.toBeNull();
      expect(playerInterfaces[0]![entityId]).not.toBeUndefined();
      expect(playerInterfaces[1]![entityId]).not.toBeNull();
      expect(playerInterfaces[1]![entityId]).not.toBeUndefined();
    });
  });

  describe('anyEntity', () => {
    test('returns any entity of the given type if there are multiple entities of that type.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.anyEntity(TestEntityA)).toMatchObject({
        [entityId]: expect.stringMatching(/testentityA-[1-3]/),
      });
    });

    test('returns null if there are no entities of the given type.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(
        game.anyEntity(
          class NonExistingEntity extends Entity {
            public $type: string = 'NonExistingEntity';
            public toString(): string {
              return `NonExistingEntity`;
            }
          },
        ),
      ).toBeNull();
    });
  });

  describe('entities', () => {
    test('enriches the game with entities returned by the initialize method.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.entities()).toHaveLength(8);
      expect(game.entities(TestEntityA)).toHaveLength(3);
      expect(game.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(game.entitySet(TestEntityC)).toHaveLength(1);
      expect(game.entitySet(TestPlayerEntity)).toHaveLength(2);
    });
  });

  describe('clone', () => {
    test('works', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([new TestEntityC(1), new TestPlayerEntity(1)]);
        }

        rawGraph(): Graph<'NEXT'> {
          return {
            INITIAL: async () => {
              return 'NEXT' as const;
            },
            NEXT: async () => {
              const clone = this.clone();

              expect(clone).toBeInstanceOf(TestGame);
              expect(clone.graph().current).toEqual(this.graph().current);
              // TODO: Check that executed actions inside this graph node recorded here, too!
              // TODO: Copying this engine should literally copy the entire state, including the graph to where we currently are (with identical state)!

              done();
            },
          };
        }
      }

      // WHEN
      const game = new DummyGame();
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        // Not relevant for this test.
        state: () => {},
        prompt: () => {},
      });

      timeout(done);
    });
  });

  describe('players', () => {
    test('returns all registered player entities.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.players()).toHaveLength(2);
    });
  });

  describe('flush', () => {
    test('when an entity is spawned, or that entity is modified, it is flushed.', () => {
      // GIVEN
      const flush = spyOn(TestGame.prototype, 'flush');
      const game = new TestGame();

      // WHEN
      const entityC = game.anyEntity(TestEntityC)!;

      entityC.volatileNumber = 42;

      // THEN
      expect(flush).toHaveBeenCalledTimes(
        8 + // 8 Entities spawned.
          1, // 1 Entity modified.
      );
    });
  });

  describe('registerPlayerCallback', () => {
    test('sends the choices available to a player if that player reconnects.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([
            new TestPlayerEntity(1),
            new TestPlayerEntity(2),
            new TestEntityC(1),
          ]);
        }

        rawGraph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              const playerThatWillDisconnect =
                runtime.entities(TestPlayerEntity)[0]!;

              await runtime.prompt(playerThatWillDisconnect, [
                new TestAction(),
                new TestAction(),
                new TestAction(),
              ]);
            },
          };
        }
      }
      const game = new DummyGame();
      const disconnectedPlayer = game.entities(TestPlayerEntity)[0]!;

      game.registerPlayerCallback(disconnectedPlayer, {
        // Not relevant, the reconnected callback is more interesting.
        state: () => {},
        prompt: () => {},
      });
      let normalPlayerStateCalled = 0;
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[1]!, {
        state: () => {
          normalPlayerStateCalled++;
          if (normalPlayerStateCalled > 1) {
            throw new Error(
              'Player should not receive state updates for other players reconnecting!',
            );
          }
        },
        prompt: (choices) => {
          if (choices.length > 0) {
            throw new Error('This player should not have any choices!');
          }
        },
      });

      // WHEN
      setTimeout(() => {
        // Players reconnects and registers their callback again:
        let reconnectedPlayerStateCalled = false;
        let reconnectedPlayerChoicesCalled = false;

        game.registerPlayerCallback(disconnectedPlayer, {
          state: (snapshots) => {
            // THEN
            // State is sent again.
            expect(snapshots).toHaveLength(1);
            expect(Object.keys(snapshots[0]?.dirtyEntities!)).toHaveLength(3); // The full state should be sent!

            reconnectedPlayerStateCalled = true;
            if (reconnectedPlayerChoicesCalled) {
              done();
            }
          },
          prompt: (choices) => {
            // THEN
            // Prompts are sent again.
            expect(choices).toHaveLength(3);

            reconnectedPlayerChoicesCalled = true;
            if (reconnectedPlayerStateCalled) {
              done();
            }
          },
        });
      }, 10);

      timeout(done, 20);
    });

    test('issues a warning if a callback is registered when another callback is already registered.', () => {
      // GIVEN
      const game = new TestGame(undefined, { logger });

      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: () => {},
      });
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[1]!, {
        state: () => {},
        prompt: () => {},
      });

      // THEN #1
      expect(logger.warn).toHaveBeenCalledTimes(0);

      // WHEN
      // The same player interface is overwritten!
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: () => {},
      });

      // THEN #2
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/overwrit/gi),
      );
    });

    test('the game does not start until all player interfaces have handlers registered.', async () => {
      // GIVEN
      const game = new TestGame();

      const player1Callback = { state: mock(() => {}), prompt: mock(() => {}) };
      const player2Callback = { state: mock(() => {}), prompt: mock(() => {}) };

      // WHEN #1
      await game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );

      // THEN #1
      expect(player1Callback.state).toHaveBeenCalledTimes(0);
      expect(player2Callback.state).toHaveBeenCalledTimes(0);
      expect(player1Callback.prompt).toHaveBeenCalledTimes(0);
      expect(player2Callback.prompt).toHaveBeenCalledTimes(0);

      // WHEN #2
      await game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        player2Callback,
      );

      // THEN #2
      expect(player1Callback.state).toHaveBeenCalledTimes(1);
      expect(player2Callback.state).toHaveBeenCalledTimes(1);
      expect(player1Callback.prompt).toHaveBeenCalledTimes(0);
      expect(player2Callback.prompt).toHaveBeenCalledTimes(0);
    });

    test('sends an initial state to all players.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([new TestEntityC(1), new TestPlayerEntity(1)]);
        }
      }
      const game = new DummyGame();

      // WHEN #1
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: (snapshots) => {
          expect(snapshots).toHaveLength(1);
          expect(snapshots[0]?.executed).toBeUndefined(); // We did not enter this snapshot due to an action, but the setup!
          expect(jsonRoundtrip(snapshots[0]?.dirtyEntities)).toEqual({
            'testPlayerEntity-1': {
              $type: 'TestPlayerEntity',
            },
            'testentityC-1': {
              $type: 'TestEntityC',
              volatileNumber: 0,
            },
          });

          done();
        },
        // Not relevant for this test.
        prompt: () => {},
      });

      timeout(done);
    });

    test('if a player interface registers a callback while the game is already running, only the callback is replaced.', async () => {
      // GIVEN
      const player1Callback = { state: mock(() => {}), prompt: mock(() => {}) };
      const player2Callback = { state: mock(() => {}), prompt: mock(() => {}) };

      const game = new TestGame();
      await game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );
      await game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        player2Callback,
      );

      // THEN #1
      expect(player1Callback.state).toHaveBeenCalledTimes(1);
      expect(player2Callback.state).toHaveBeenCalledTimes(1);

      // WHEN
      // A single player callback is overwritten, maybe because the client disconnected and reconnected.
      // In this case, the second player should not be informed about this, and only the reconnected
      // player should be informed about their state again.
      await game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );

      // THEN
      expect(player1Callback.state).toHaveBeenCalledTimes(2);
      expect(player2Callback.state).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle', () => {
    test('the node graph execution stops if the game is already over.', (done) => {
      // GIVEN
      let initialNodeExecuted = 0;

      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([new TestPlayerEntity(1)]);
        }

        rawGraph(): Graph<'INITIAL' | 'IMPOSSIBLE'> {
          return {
            INITIAL: async (runtime) => {
              initialNodeExecuted++;

              // WHEN
              // We hack a little and access ".end()" here directly, but ideally, this should always be accessed through an action, so that the client sees it!
              this.end({ winners: runtime.entities(TestPlayerEntity) });

              // Graph execution should stop here, so in total, this node should only be executed once and no other nodes.
              return 'IMPOSSIBLE' as const;
            },
            IMPOSSIBLE: async () => {
              throw new Error(
                `Graph looped back to CHECK node after game ended, which should not happen!`,
              );
            },
          };
        }
      }

      // WHEN
      const game = new DummyGame();

      game.registerCallbacks({
        onEnd: () => {
          // THEN
          // Making sure that the graph _does not_ endlessly loop is tough from the outside world, so we simply check whether it came back.
          setTimeout(() => {
            expect(initialNodeExecuted).toBe(1);
            done();
          }, 100);
        },
      });
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: () => {},
      });

      timeout(done, 200);
    });

    test('choices cant be picked after the state has already moved on.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([
            new TestPlayerEntity(1),
            new TestPlayerEntity(2),
            new TestEntityC(1),
          ]);
        }

        rawGraph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              await runtime.execute(
                await runtime.prompt(runtime.entities(TestPlayerEntity)[0]!, [
                  new ParameterizedTestAction({ value: 1 }),
                ]),
              );
              await runtime.execute(
                await runtime.prompt(runtime.entities(TestPlayerEntity)[1]!, [
                  new ParameterizedTestAction({ value: 2 }),
                ]),
              );

              // After some delay, check!
              setTimeout(() => {
                expect(runtime.anyEntity(TestEntityC)!.volatileNumber).toBe(2); // The second choice was the last one, so this should be the new value.
                done();
              }, 50);
            },
          };
        }
      }

      // WHEN
      const game = new DummyGame();
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: () => {},
        prompt: (choices, execute) => {
          execute(choices[0]!);
          setTimeout(() => execute(choices[0]!), 10); // Try to execute the same choice again after some time, which should not be possible!
        },
      });
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[1]!, {
        state: () => {},
        prompt: (choices, execute) => {
          execute(choices[0]!);
        },
      });

      timeout(done, 100);
    });

    test('delayed choice executions are handled correctly.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([new TestPlayerEntity(1), new TestEntityC(1)]);
        }

        rawGraph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              await runtime.execute(
                await runtime.prompt(runtime.anyEntity(TestPlayerEntity)!, [
                  new TestAction(),
                ]),
              );
            },
          };
        }
      }
      const game = new DummyGame();

      // WHEN
      let triggered = false;
      game.registerPlayerCallback(game.players()[0]!, {
        // Not relevant for this test.
        state: () => {
          if (triggered) {
            done();
          }
        },
        prompt: (choices, execute) => {
          if (choices.length > 0 && !triggered) {
            setTimeout(() => {
              triggered = true;
              execute(choices[0]!);
            }, 50);
          }
        },
      });

      timeout(done, 100);
    });

    test('throws an error after a given max. state depth has reached.', async () => {
      // GIVEN
      class DummyGame extends TestGame {
        public maxDepth = 3;

        initialize() {
          return new Set<Entity>([new TestPlayerEntity(1), new TestEntityC(1)]);
        }

        // This graph never ends, which should be caught by the engine checks!
        rawGraph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              await runtime.execute(
                await runtime.prompt(runtime.anyEntity(TestPlayerEntity)!, [
                  new TestAction(),
                ]),
              );
              return 'INITIAL' as const;
            },
          };
        }
      }

      const game = new DummyGame();

      // WHEN
      let choiceExecutionCount = 0;
      expect(
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test.
          state: () => {},
          prompt: (choices, executor) => {
            choiceExecutionCount++;
            executor(choices[0]!);
          },
        }),
      ).rejects.toThrowError(/maximum depth/gi);
    });

    test('the game starts when all player interfaces have registered a callback. players are informed about the initial state.', (done) => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      let player1SnapshotsInformed = false;
      let player2SnapshotsInformed = false;

      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: (snapshots) => {
          // Only a single state is issued to the player!
          expect(snapshots).toHaveLength(1);
          expect(snapshots[0]?.executed).toBeUndefined();

          const snapshot = snapshots[0]!.dirtyEntities;
          expect(JSON.parse(JSON.stringify(snapshot))).toEqual({
            'testentityA-1': {
              $type: 'TestEntityA',
            },
            'testentityA-2': {
              $type: 'TestEntityA',
            },
            'testentityA-3': {
              $type: 'TestEntityA',
            },
            'testentityB-1': {
              $type: 'TestEntityB',
            },
            'testentityB-2': {
              $type: 'TestEntityB',
            },
            'testentityC-1': {
              volatileNumber: 0,
              $type: 'TestEntityC',
            },
            'testPlayerEntity-1': {
              $type: 'TestPlayerEntity',
            },
            'testPlayerEntity-2': {
              $type: 'TestPlayerEntity',
            },
          });

          player1SnapshotsInformed = true;
          if (player2SnapshotsInformed) {
            done();
          }
        },
        // Not relevant for this test.
        prompt: () => {},
      });

      game.registerPlayerCallback(game.entities(TestPlayerEntity)[1]!, {
        state: (snapshots) => {
          // Only a single state is issued to the player!
          expect(snapshots).toHaveLength(1);
          expect(snapshots[0]?.executed).toBeUndefined();

          const snapshot = snapshots[0]!.dirtyEntities;
          expect(JSON.parse(JSON.stringify(snapshot))).toEqual({
            'testentityA-1': {
              $type: 'TestEntityA',
            },
            'testentityA-2': {
              $type: 'TestEntityA',
            },
            'testentityA-3': {
              $type: 'TestEntityA',
            },
            'testentityB-1': {
              $type: 'TestEntityB',
            },
            'testentityB-2': {
              $type: 'TestEntityB',
            },
            'testentityC-1': {
              volatileNumber: 0,
              $type: 'TestEntityC',
            },
            'testPlayerEntity-1': {
              $type: 'TestPlayerEntity',
            },
            'testPlayerEntity-2': {
              $type: 'TestPlayerEntity',
            },
          });

          player2SnapshotsInformed = true;
          if (player1SnapshotsInformed) {
            done();
          }
        },
        // Not relevant for this test.
        prompt: () => {},
      });

      timeout(done);
    });

    test('Choices are sent to the player and on execute, return to the script.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([new TestPlayerEntity(1)]);
        }

        rawGraph(): Graph<NodeId> {
          return {
            INITIAL: async (runtime) => {
              const player =
                runtime.anyEntity<TestPlayerEntity>(TestPlayerEntity)!;

              const result = await runtime.prompt(player, [new TestAction()]);

              expect(result).toBeDefined();
              expect(result).toBeInstanceOf(TestAction);
              done();
            },
          };
        }
      }

      const game = new DummyGame();

      // WHEN
      game.registerPlayerCallback(game.anyEntity(TestPlayerEntity)!, {
        // Not relevant for this test.
        state: () => {},
        prompt: (choices, execute) => {
          // THEN
          expect(choices).toHaveLength(1);
          expect(choices[0]?.execution).toBeInstanceOf(TestAction);

          execute(choices[0]!);
        },
      });

      timeout(done);
    });

    test('sends only modified entities of the state to the player after a choice is picked. choices reset.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([
            new TestEntityC(1),
            new TestEntityC(2),
            new TestPlayerEntity(1),
          ]);
        }

        rawGraph(): Graph {
          return {
            INITIAL: async (runtime) => {
              await runtime.execute(new TestAction());
            },
          };
        }
      }
      const game = new DummyGame();

      // WHEN
      let snapshotCount = 0;

      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: (snapshots) => {
          snapshotCount++;

          if (snapshotCount > 1) {
            // THEN
            expect(snapshots).toHaveLength(1);
            expect(jsonRoundtrip(snapshots[0]?.dirtyEntities)).toEqual({
              'testentityC-1': {
                // The action modified this property!
                volatileNumber: 1,
                $type: 'TestEntityC',
              },
            });

            done();
          }
        },
        prompt: (choices, executor) => {
          if (choices.length > 0) {
            executor(choices[0]!);
          }
        },
      });

      timeout(done);
    });

    test('if a choice is executed that does not exist, an error is logged and nothing happens.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([new TestPlayerEntity(1)]);
        }

        rawGraph() {
          return {
            INITIAL: async (runtime: GraphRuntime) => {
              await runtime.prompt(runtime.anyEntity(TestPlayerEntity)!, [
                new TestAction(),
              ]);
            },
          };
        }
      }
      const game = new DummyGame(undefined, { logger });

      // WHEN
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        // Not relevant for this test.
        state: () => {},
        prompt: (_choices, executor) => {
          executor(12345);

          expect(logger.error).toHaveBeenCalledWith(
            expect.stringMatching(/12345/gi),
          );
          done();
        },
      });

      timeout(done);
    });

    test('if a player instantly executes a choice in-memory, the other player is atleast notified about the state change.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        rawGraph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              const player =
                runtime.anyEntity<TestPlayerEntity>(TestPlayerEntity)!;
              await runtime.execute(
                await runtime.prompt(player, [new TestAction()]),
              );

              return 'INITIAL' as const;
            },
          };
        }
      }
      const game = new DummyGame();

      let playerAtriggered = 0;
      let playerBtriggered = 0;

      // WHEN
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        // Not relevant for this test.
        state: () => {
          playerAtriggered++;
        },
        prompt: (choices, executor) => {
          if (playerAtriggered < 5) {
            executor(Array.from(choices)[0]!);
          } else {
            // THEN
            expect(playerAtriggered).toEqual(5);
            expect(playerBtriggered).toEqual(5);
            done();
          }
        },
      });
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[1]!, {
        state: () => {
          playerBtriggered++;
        },
        // Not relevant for this test.
        prompt: () => {},
      });

      timeout(done);
    });

    test('the serialized state sent to the player is correct.', (done) => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        state: (snapshots) => {
          // THEN
          expect(JSON.parse(JSON.stringify(snapshots))).toEqual([
            {
              dirtyEntities: {
                'testentityA-1': {
                  // We send the entity type too, so that the client knows how to construct the object of this type again.
                  $type: 'TestEntityA',
                },
                'testentityA-2': {
                  $type: 'TestEntityA',
                },
                'testentityA-3': {
                  $type: 'TestEntityA',
                },
                'testentityB-1': {
                  $type: 'TestEntityB',
                },
                'testentityB-2': {
                  $type: 'TestEntityB',
                },
                'testentityC-1': {
                  $type: 'TestEntityC',
                  volatileNumber: 0,
                },
                'testPlayerEntity-1': {
                  $type: 'TestPlayerEntity',
                },
                'testPlayerEntity-2': {
                  $type: 'TestPlayerEntity',
                },
              },
            },
          ]);

          done();
        },
        // Not relevant for this test.
        prompt: () => {},
      });
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        // Player 2 is not relevant for this test.
        {
          prompt: () => {},
          state: () => {},
        },
      );

      timeout(done);
    });

    test('referenced entities in choices are serialized using a placeholder.', (done) => {
      // GIVEN
      class TargetedAction extends Action<
        'TargetedAction',
        {
          target: Entity;
          nested: { target: Entity };
        }
      > {
        async doApply(): Promise<void> {
          // Not relevant for this test.
        }
        public $type: 'TargetedAction' = 'TargetedAction';
      }

      class DummyGame extends TestGame {
        initialize(): Set<Entity> {
          return new Set<Entity>([new TestEntityC(1), new TestPlayerEntity(1)]);
        }
        rawGraph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              const entity = runtime.anyEntity<TestEntityC>(TestEntityC)!;

              await runtime.execute(
                await runtime.prompt(runtime.anyEntity(TestPlayerEntity)!, [
                  new TargetedAction({
                    target: entity,
                    nested: { target: entity },
                  }),
                ]),
              );
            },
          };
        }
      }
      const game = new DummyGame();

      // WHEN
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        // Not relevant for this test.
        state: () => {},
        prompt: (choices) => {
          expect(jsonRoundtrip(choices[0]!)).toEqual({
            id: 0,
            execution: {
              type: 'TargetedAction',
              parameters: {
                // The referenced entity should be replaced with a reference string, so that the client can resolve it again.
                target: '$ENGINE:testentityC-1',
                nested: {
                  // Nested values are also supported!
                  target: '$ENGINE:testentityC-1',
                },
              },
            },
            player: '$ENGINE:testPlayerEntity-1',
          });

          done();
        },
      });

      timeout(done);
    });

    test('lifecycle hooks on entities are executed before and after actions are executed.', (done) => {
      // GIVEN
      class LifecycleEntity
        extends Entity
        implements BeforeAction<TestAction>, AfterAction<TestAction>
      {
        beforeTriggered = false;

        afterTestAction(
          _runtime: ModifiableRuntime,
          parameters: undefined,
          returnType?: void | undefined,
        ) {
          expect(parameters).toBeUndefined();
          expect(returnType).toBeUndefined();

          if (this.beforeTriggered) {
            done();
          }
        }
        beforeTestAction(_runtime: ModifiableRuntime, parameters: undefined) {
          expect(parameters).toBeUndefined();

          this.beforeTriggered = true;
        }

        public $type: string = 'LifecycleEntity';

        toString() {
          return `LifecycleEntity`;
        }
      }

      class DummyGame extends TestGame {
        initialize(): Set<Entity> {
          return new Set<Entity>([
            new TestPlayerEntity(1),
            new TestEntityC(1),
            new LifecycleEntity('lifecycle-entity'),
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

      // WHEN
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        // Not relevant for this test.
        prompt: () => {},
        state: () => {},
      });

      timeout(done);
    });

    test('if multiple entities trigger at the same time, the resolveTriggerOrder method is called to determine the order.', async () => {
      // GIVEN
      let triggersCalled = 0;
      const beforeCalledEntities: string[] = [];
      const afterCalledEntities: string[] = [];

      class LifecycleEntity
        extends Entity
        implements BeforeAction<TestAction>, AfterAction<TestAction>
      {
        afterTestAction() {
          afterCalledEntities.push(this[entityId]);
        }
        beforeTestAction() {
          beforeCalledEntities.push(this[entityId]);
        }

        public $type: string = 'LifecycleEntity';

        toString() {
          return `LifecycleEntity`;
        }
      }

      class DummyGame extends TestGame {
        initialize(): Set<Entity> {
          return new Set<Entity>([
            new TestPlayerEntity(1),
            new TestEntityC(1),
            new LifecycleEntity('a'),
            new LifecycleEntity('b'),
            new LifecycleEntity('c'),
          ]);
        }

        rawGraph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              await runtime.execute(new TestAction());
            },
          };
        }

        override resolveTriggerOrder(
          type: LifecycleType,
          _action: Action<any, any, any>,
          entities: Entity[],
        ): Entity[] {
          triggersCalled++;

          return entities.sort((a, b) =>
            type === 'before'
              ? a[entityId].localeCompare(b[entityId])
              : b[entityId].localeCompare(a[entityId]),
          );
        }
      }

      const game = new DummyGame();

      // WHEN
      await game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        // Not relevant for this test.
        prompt: () => {},
        state: () => {},
      });

      expect(triggersCalled).toEqual(2); // before and after triggers.
      expect(beforeCalledEntities).toEqual(['a', 'b', 'c']);
      expect(afterCalledEntities).toEqual(['c', 'b', 'a']);
    });

    describe('execute', () => {
      test('a choice cant be executed if the game is already over.', (done) => {
        // GIVEN
        class DummyGame extends TestGame {
          initialize() {
            return new Set<Entity>([
              new TestPlayerEntity(1),
              new TestEntityC(1),
            ]);
          }

          rawGraph(): Graph<'INITIAL'> {
            return {
              INITIAL: async (runtime) => {
                // WHEN
                // We hack a little and access ".end()" here directly, but ideally, this should always be accessed through an action, so that the client sees it!
                this.end({
                  draws: [runtime.anyEntity(TestPlayerEntity)!],
                });
                await runtime.execute(new TestAction());

                // THEN
                expect(runtime.anyEntity(TestEntityC)!.volatileNumber).toBe(0); // The action should not have been executed, so the state should be unchanged.

                done();
              },
            };
          }
        }

        const game = new DummyGame();
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test, game just needs to start.
          state: () => {},
          prompt: () => {},
        });

        timeout(done);
      });

      test('if a choice is prevented in a beforeTrigger, the action does not get executed and the player is not informed about any changes.', (done) => {
        // GIVEN
        class PreventingEntity
          extends Entity
          implements BeforeAction<TestAction>
        {
          public $type: string = 'PreventingEntity';
          public toString(): string {
            return `PreventingEntity`;
          }

          // This prevents _all_ TestActions from being executed!
          beforeTestAction(_runtime: ModifiableRuntime): false {
            return false;
          }
        }

        class DummyGame extends TestGame {
          initialize() {
            return new Set<Entity>([
              new PreventingEntity('preventing-entity'),
              new TestEntityC(1),
              new TestPlayerEntity(1),
            ]);
          }

          rawGraph(): Graph<'INITIAL'> {
            return {
              INITIAL: async (runtime) => {
                // This action should be cancelled!
                expect(await runtime.execute(new TestAction())).toBeUndefined();
                done();
              },
            };
          }
        }

        const game = new DummyGame();

        // WHEN
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test, game just needs to start.
          state: () => {},
          prompt: () => {},
        });

        timeout(done);
      });

      test('executing an action returns executed action and sends an update to each player.', (done) => {
        // GIVEN
        class DummyGame extends TestGame {
          initialize() {
            return new Set<Entity>([
              new TestEntityC(1),
              new TestPlayerEntity(1),
            ]);
          }

          rawGraph(): Graph<'NEXT'> {
            return {
              INITIAL: async () => {
                return 'NEXT' as const;
              },
              NEXT: async (runtime) => {
                const action = new TestAction();
                const returned = await runtime.execute(action);

                // THEN
                expect(returned).toBe(action);
              },
            };
          }
        }

        const game = new DummyGame();

        let player1Updated = 0;
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          state: (snapshots) => {
            // THEN
            player1Updated++;

            expect(snapshots).toHaveLength(1);

            if (player1Updated === 1) {
              // Initial state - do nothing!
              expect(jsonRoundtrip(snapshots[0]?.dirtyEntities)).toEqual({
                'testentityC-1': {
                  volatileNumber: 0,
                  $type: 'TestEntityC',
                },
                'testPlayerEntity-1': {
                  $type: 'TestPlayerEntity',
                },
              });

              return;
            }

            if (player1Updated === 2) {
              expect(jsonRoundtrip(snapshots[0]?.dirtyEntities)).toEqual({
                'testentityC-1': {
                  volatileNumber: 1,
                  $type: 'TestEntityC',
                },
              });
            }

            done();
          },
          // Not relevant for this test.
          prompt: () => {},
        });

        timeout(done);
      });

      test('executing an action that is not recorded in the game logs an error, because clients might not know about its existence.', (done) => {
        // GIVEN
        class UnloggedAction extends Action<'UnloggedAction', undefined, void> {
          public $type: 'UnloggedAction' = 'UnloggedAction';
          async doApply(): Promise<void> {
            // Not relevant for this test.
          }
        }

        class DummyGame extends TestGame {
          initialize(): Set<Entity> {
            return new Set<Entity>([new TestPlayerEntity(1)]);
          }
          rawGraph(): Graph<'INITIAL'> {
            return {
              INITIAL: async (runtime) => {
                // WHEN
                await runtime.execute(new UnloggedAction());

                // THEN
                expect(logger.error).toHaveBeenCalledWith(
                  expect.stringMatching(/UnloggedAction/gi),
                );
                done();
              },
            };
          }
        }

        const game = new DummyGame(undefined, { logger });

        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test.
          state: () => {},
          prompt: () => {},
        });

        timeout(done);
      });

      test('execute() awaits async before/after-hooks before returning.', (done) => {
        // GIVEN
        class AsyncAfterEntity
          extends Entity
          implements AfterAction<TestAction>
        {
          public $type: string = 'AsyncAfterEntity';
          public result: number = 0;

          constructor() {
            super('async-after-entity');
          }

          async afterTestAction(_runtime: ModifiableRuntime): Promise<void> {
            return new Promise((resolve) =>
              setTimeout(() => {
                this.result = 42;
                resolve();
              }, 50),
            );
          }

          public toString(): string {
            return 'AsyncAfterEntity';
          }
        }

        class DummyGame extends TestGame {
          initialize() {
            return new Set<Entity>([
              new TestPlayerEntity(1),
              new TestEntityC(1),
              new AsyncAfterEntity(),
            ]);
          }

          rawGraph(): Graph<'INITIAL'> {
            return {
              INITIAL: async (runtime) => {
                const entity = runtime.anyEntity(AsyncAfterEntity)!;

                // WHEN
                await runtime.execute(new TestAction());

                // THEN
                // The value is set here asynchronously through the after-hook.
                expect(entity.result).toBe(42);
                done();
              },
            };
          }
        }

        const game = new DummyGame();
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          state: () => {},
          prompt: () => {},
        });

        timeout(done, 100);
      });

      test('after-hooks observe entity state mutated by a nested execute() inside doApply', (done) => {
        // GIVEN
        class InnerAction extends Action<'InnerAction', undefined, void> {
          public $type: 'InnerAction' = 'InnerAction';
          async doApply(runtime: ModifiableRuntime): Promise<void> {
            runtime.anyEntity(TestEntityC)!.volatileNumber = 99;
          }
        }

        class OuterAction extends Action<'OuterAction', undefined, void> {
          public $type: 'OuterAction' = 'OuterAction';
          async doApply(runtime: GraphRuntime): Promise<void> {
            await runtime.execute(new InnerAction());
          }
        }

        // Records what volatileNumber looked like when afterOuterAction fired.
        let observedInAfterHook = -1;

        class ObserverEntity
          extends Entity
          implements AfterAction<OuterAction>
        {
          public $type: string = 'ObserverEntity';
          constructor() {
            super('observer-entity');
          }
          afterOuterAction(runtime: ModifiableRuntime): void {
            observedInAfterHook =
              runtime.anyEntity(TestEntityC)!.volatileNumber;
          }
          public toString() {
            return 'ObserverEntity';
          }
        }

        class DummyGame extends TestGame {
          initialize() {
            return new Set<Entity>([
              new TestEntityC(1),
              new TestPlayerEntity(1),
              new ObserverEntity(),
            ]);
          }

          rawGraph(): Graph<'INITIAL'> {
            return {
              INITIAL: async (runtime) => {
                // WHEN
                await runtime.execute(new OuterAction());

                // THEN: InnerAction ran during doApply, so by the time
                // afterOuterAction fired, volatileNumber should already be 99.
                expect(observedInAfterHook).toBe(99);
                done();
              },
            };
          }
        }

        const game = new DummyGame();
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          state: () => {},
          prompt: () => {},
        });

        timeout(done);
      });
    });

    describe('lifecycle hooks', () => {
      test('modifying triggered actions using the beforeTrigger works correctly.', (done) => {
        // GIVEN
        class LifecycleHookEntity
          extends Entity
          implements BeforeAction<ParameterizedTestAction>
        {
          public $type: string = 'LifecycleHookEntity';
          public toString(): string {
            return `LifecycleHookEntity`;
          }

          beforeParameterizedTestAction(
            _runtime: ModifiableRuntime,
            parameters: { value: number },
          ) {
            parameters.value -= 1;
          }
        }

        class DummyGame extends TestGame {
          initialize() {
            return new Set<Entity>([
              new LifecycleHookEntity('my-trigger-entity'),
              new TestEntityC(1),
              new TestPlayerEntity(1),
            ]);
          }

          rawGraph(): Graph<'INITIAL'> {
            return {
              INITIAL: async (runtime) => {
                await runtime.execute(
                  new ParameterizedTestAction({
                    value: 10,
                  }),
                );

                expect(
                  runtime.anyEntity<TestEntityC>(TestEntityC)?.volatileNumber,
                ).toEqual(9);

                done();
              },
            };
          }
        }

        const game = new DummyGame();

        // WHEN
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test, game just needs to start.
          state: () => {},
          prompt: () => {},
        });

        timeout(done);
      });

      test('modifying triggered actions using the afterTrigger does not work.', (done) => {
        // GIVEN
        class LifecycleHookEntity
          extends Entity
          implements AfterAction<ParameterizedTestAction>
        {
          public $type: string = 'LifecycleHookEntity';
          public toString(): string {
            return `LifecycleHookEntity`;
          }

          afterParameterizedTestAction(
            _runtime: ModifiableRuntime,
            parameters: { value: number },
          ) {
            expect(() => (parameters.value -= 1)).toThrowError(/readonly/);
            done();
          }
        }

        class DummyGame extends TestGame {
          initialize() {
            return new Set<Entity>([
              new LifecycleHookEntity('my-trigger-entity'),
              new TestEntityC(1),
              new TestPlayerEntity(1),
            ]);
          }

          rawGraph(): Graph<'INITIAL'> {
            return {
              INITIAL: async (runtime) => {
                await runtime.execute(
                  new ParameterizedTestAction({
                    value: 10,
                  }),
                );
              },
            };
          }
        }

        const game = new DummyGame();

        // WHEN
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test, game just needs to start.
          state: () => {},
          prompt: () => {},
        });

        timeout(done);
      });

      test('check-hooks are called when an action is directly executed and may prevent the action.', (done) => {
        // GIVEN
        class CheckHookEntity
          extends Entity
          implements CheckAction<ParameterizedTestAction>
        {
          public toString(): string {
            return `CheckHookEntity`;
          }
          checkParameterizedTestAction(
            _runtime: ModifiableRuntime,
            parameters: { value: number },
          ) {
            return parameters.value % 2 == 0;
          }
          public $type: string = 'CheckHookEntity';
        }

        class DummyGame extends TestGame {
          initialize(): Set<Entity> {
            return new Set<Entity>([
              new CheckHookEntity('my-check-entity'),
              new TestEntityC(1),
              new TestPlayerEntity(1),
            ]);
          }

          rawGraph(): Graph<NodeId> {
            return {
              INITIAL: async (runtime) => {
                // WHEN
                // This action should be executed, since its check hook returns true.
                expect(
                  await runtime.execute(
                    new ParameterizedTestAction({ value: 10 }),
                  ),
                ).toBeDefined();
                // Action should be prevented, so undefined is returned.
                expect(
                  await runtime.execute(
                    new ParameterizedTestAction({
                      value: 5,
                    }),
                  ),
                ).toBeUndefined();

                // THEN
                expect(
                  runtime.anyEntity<TestEntityC>(TestEntityC)?.volatileNumber,
                ).toEqual(10); // Only the valid changes are applied!

                done();
              },
            };
          }
        }

        const game = new DummyGame();

        // WHEN
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test, game just needs to start.
          state: () => {},
          prompt: () => {},
        });

        timeout(done);
      });

      test('check hooks are automatically applied to prompted choices.', (done) => {
        // GIVEN
        class CheckHookEntity
          extends Entity
          implements CheckAction<ParameterizedTestAction>
        {
          public $type: string = 'CheckHookEntity';
          checkParameterizedTestAction(
            _runtime: ModifiableRuntime,
            parameters: { value: number },
          ) {
            return parameters.value % 2 === 0;
          }
          public toString(): string {
            return `CheckHookEntity`;
          }
        }

        class DummyGame extends TestGame {
          initialize(): Set<Entity> {
            return new Set<Entity>([
              new CheckHookEntity('my-check-entity'),
              new TestEntityC(1),
              new TestPlayerEntity(1),
            ]);
          }

          rawGraph(): Graph<'INITIAL'> {
            return {
              INITIAL: async (runtime) => {
                await runtime.prompt(runtime.anyEntity(TestPlayerEntity)!, [
                  new ParameterizedTestAction({ value: 10 }),
                  new ParameterizedTestAction({ value: 5 }),
                ]);
              },
            };
          }
        }

        const game = new DummyGame();
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test, game just needs to start.
          state: () => {},
          prompt: (choices) => {
            expect(choices).toHaveLength(1);
            done();
          },
        });
      });
    });

    describe('status', () => {
      test('a game goes through "setup" into "running" status.', async () => {
        // GIVEN
        class DummyGame extends TestGame {
          rawGraph(): Graph<'INITIAL'> {
            return {
              // Not relevant for this test.
              INITIAL: async () => {},
            };
          }

          initialize(): Set<Entity> {
            return new Set<Entity>([new TestPlayerEntity(1)]);
          }
        }
        const game = new DummyGame();

        // THEN
        expect(game.status()).toEqual('setup');

        // WHEN
        await game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
          // Not relevant for this test.
          prompt: () => {},
          state: () => {
            // THEN
            expect(game.status()).toEqual('running');
          },
        });

        expect(game.status()).toEqual('ended');
      });
    });

    describe('end', () => {
      test('when a game ends, an end of game callback is triggered.', (done) => {
        // GIVEN
        class DummyGame extends TestGame {
          rawGraph(): Graph<'INITIAL'> {
            return {
              // Not relevant for this test.
              INITIAL: async (runtime) => {
                // We hack a little and access ".end()" here directly, but ideally, this should always be accessed through an action, so that the client sees it!
                this.end({
                  winners: [runtime.anyEntity(TestPlayerEntity)!],
                });
              },
            };
          }

          initialize(): Set<Entity> {
            return new Set<Entity>([new TestPlayerEntity(1)]);
          }
        }
        const game = new DummyGame();

        // THEN
        expect(game.status()).toEqual('setup');

        game.registerCallbacks({
          onEnd: (endStatus) => {
            expect(endStatus).toEqual({
              winners: [game.entities(TestPlayerEntity)[0]!],
              losers: [],
              draws: [],
            });
            done();
          },
        });

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          // Player 1 is not relevant for this test.
          {
            // Not relevant for this test.
            prompt: () => {},
            state: () => {
              expect(game.endStatus()).toBeUndefined();
            },
          },
        );

        timeout(done);
      });

      test.each([
        ['winners', 'losers'],
        ['winners', 'draws'],
        ['losers', 'draws'],
      ])(
        'if a player occurs in more than one category, an error is thrown.',
        (category1, category2) => {
          // GIVEN
          const game = new TestGame();
          const player = game.entities(TestPlayerEntity)[0]!;

          // WHEN
          expect(() =>
            game.end({
              [category1]: [player],
              [category2]: [player],
            }),
          ).toThrowError(/multiple categories/gi);
        },
      );

      test('if the game ends without any game-over information, an error is thrown.', () => {
        // GIVEN
        const game = new TestGame();

        // WHEN
        expect(() => game.end({})).toThrowError();
      });

      test.each([['winners'], ['losers'], ['draws']])(
        'throws an error if %s contains an undefined player.',
        (type) => {
          // GIVEN
          const game = new TestGame();

          // WHEN
          expect(() =>
            game.end({
              // But no player is registered...
              [type]: [undefined],
            }),
          ).toThrowError(/undefined/gi);
        },
      );

      test('ignores a game over state if an ended game is ended again.', () => {
        // GIVEN
        const game = new TestGame();

        // WHEN
        game.end({ winners: [game.entities(TestPlayerEntity)[0]!] });
        game.end({ winners: [game.entities(TestPlayerEntity)[1]!] });

        // THEN
        expect(game.endStatus()).toEqual({
          winners: [game.entities(TestPlayerEntity)[0]!], // Not the 2nd player!
          losers: [],
          draws: [],
        });
      });

      test.each([['winners'], ['losers'], ['draws']])(
        'if the game assigns a non-registered player as either winner/loser/draw, an error is thrown.',
        (target) => {
          // GIVEN
          const game = new TestGame();

          // WHEN
          expect(() =>
            game.end({
              [target]: [
                {
                  $type: 'TestPlayerEntity',
                  [entityId]: 'non-existing-player-id',
                } as any,
              ],
            }),
          ).toThrowError(/non-existing-player-id/gi);
        },
      );
    });

    describe('end status', () => {
      test('while the game is starting, end status is undefined.', () => {
        // GIVEN
        const game = new TestGame();

        // THEN
        expect(game.endStatus()).toBeUndefined();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          // Player 1 is not relevant for this test.
          {
            state: () => {
              // THEN
              expect(game.endStatus()).toBeUndefined();
            },
            prompt: () => {},
          },
        );
      });

      test('returns the correct end status after the game ended.', () => {
        // GIVEN
        const game = new TestGame();

        // WHEN
        game.end({
          winners: [game.entities(TestPlayerEntity)[0]!],
          losers: [game.entities(TestPlayerEntity)[1]!],
        });
        expect(game.endStatus()).toEqual({
          winners: [game.entities(TestPlayerEntity)[0]!],
          losers: [game.entities(TestPlayerEntity)[1]!],
          draws: [],
        });
      });
    });

    describe('callbacks', () => {
      test('onEnd is called when the game ends.', () => {
        // GIVEN
        const onEnd = mock(() => {});
        const game = new TestGame();
        game.registerCallbacks({ onEnd });

        // WHEN
        expect(onEnd).toHaveBeenCalledTimes(0);

        // GIVEN
        game.end({ winners: [game.entities(TestPlayerEntity)[0]!] });

        // THEN
        expect(onEnd).toHaveBeenCalledTimes(1);
      });
    });

    describe('entityClassMapping', () => {
      test('returns the correct mapping.', () => {
        // GIVEN
        const game = new TestGame();

        // THEN
        expect(game.entityClassMapping()).toEqual({
          TestEntityA: TestEntityA,
          TestEntityB: TestEntityB,
          TestEntityC: TestEntityC,
          TestPlayerEntity: TestPlayerEntity,
        });
      });
    });
  });
});
