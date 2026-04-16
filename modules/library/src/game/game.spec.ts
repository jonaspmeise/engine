import { jest, describe, test, expect, spyOn, afterEach, mock } from 'bun:test';
import { Action } from '../components/action';
import { ModifiableRuntime } from './modifiable-runtime';
import { Entity, entityId } from '../components/entity';
import { Logger, NO_OP_LOGGER } from './game.types';
import { jsonRoundtrip, timeout } from '../utility.spec';
import { Choice } from '../components/choice';
import {
  TestGame,
  TestEntityA,
  TestPlayerEntity,
  TestEntityB,
  TestEntityC,
  TestAction,
} from './game.spec.types';
import { NodeId } from '../components/graph/node.types';
import { Graph } from '../components/graph/graph';

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

  describe('setup', () => {
    test.todo('calls initialize on game instantiation.', () => {
      // GIVEN when we instantiate an instance of our Testgame, initialize is called once.
      const initializeMock = spyOn(TestGame.prototype, 'initialize');

      // WHEN
      new TestGame();

      // THEN
      expect(initializeMock).toHaveBeenCalledTimes(1);
    });
  });

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
    test('delayed choice executions are handled correctly.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([new TestPlayerEntity(1), new TestEntityC(1)]);
        }

        graph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              runtime.execute(
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
        graph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              runtime.execute(
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

    test.todo(
      'logs an error if two players have a choice at the same time.',
      (done) => {
        // GIVEN
        const game = new TestGame(undefined, { logger });

        // WHEN
        let choiceSent = false;
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          (_snapshots) => {
            if (choiceSent) {
              // THEN
              expect(logger.error).toHaveBeenCalledWith(
                expect.stringMatching(/multiple.+players/gi),
              );
              done();
            }
            choiceSent = true;
          },
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          (_snapshots) => {
            if (choiceSent) {
              // THEN
              expect(logger.error).toHaveBeenCalledWith(
                expect.stringMatching(/multiple.+players/gi),
              );
              done();
            }

            choiceSent = true;
          },
        );

        timeout(done);
      },
    );

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

        graph(): Graph<NodeId> {
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

    test('executing an action inside a node script sends an update to each player.', (done) => {
      // GIVEN
      class DummyGame extends TestGame {
        initialize() {
          return new Set<Entity>([new TestEntityC(1), new TestPlayerEntity(1)]);
        }

        graph(): Graph<'NEXT'> {
          return {
            INITIAL: async () => {
              return 'NEXT' as const;
            },
            NEXT: async (runtime) => {
              runtime.execute(new TestAction());
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

        graph(): Graph {
          return {
            INITIAL: async (runtime) => {
              runtime.execute(new TestAction());
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

        graph() {
          return {
            INITIAL: async (runtime: ModifiableRuntime) => {
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
        graph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              const player =
                runtime.anyEntity<TestPlayerEntity>(TestPlayerEntity)!;
              runtime.execute(await runtime.prompt(player, [new TestAction()]));

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
        graph(): Graph<'INITIAL'> {
          return {
            INITIAL: async (runtime) => {
              const entity = runtime.anyEntity<TestEntityC>(TestEntityC)!;

              runtime.execute(
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

    test.todo(
      'triggers are passed the correct prior executed action.',
      (done) => {
        // GIVEN
        let triggerExecuted = false;

        class DummyGame extends TestGame {
          triggers() {
            return new Set<Trigger>([
              {
                name: 'Test Trigger',
                apply: (_runtime, prior) => {
                  if (prior?.execution instanceof TestAction) {
                    triggerExecuted = true;
                  }
                },
              },
            ]);
          }
        }

        // WHEN
        const dummyGame = new DummyGame(undefined, { logger: NO_OP_LOGGER });
        dummyGame.registerPlayerCallback(
          dummyGame.entities(TestPlayerEntity)[0]!,
          (_snapshots, choices, executor) => {
            if (triggerExecuted) {
              done();
            } else if (choices.length > 0) {
              executor(choices[0]!);
            }
          },
        );
        dummyGame.registerPlayerCallback(
          dummyGame.entities(TestPlayerEntity)[1]!,
          // Player 2 is not relevant for this test.
          () => {},
        );

        timeout(done);
      },
    );

    test.todo(
      'triggers are executed after in the initial game state.',
      (done) => {
        // GIVEN
        class DummyGame extends TestGame {
          triggers() {
            done();
          }
        }

        const game = new DummyGame();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          // Player 1 is not relevant for the test, because the trigger is checked at the start of the game, too.
          () => {},
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          // Player 2 is not relevant for this test.
          () => {},
        );

        timeout(done);
      },
    );

    test.todo('triggers are executed after every picked choice.', (done) => {
      // GIVEN
      let triggered = 0;
      class DummyGame extends TestGame {
        triggers() {
          if (++triggered === 2) {
            done();
          }
        }
      }

      const game = new DummyGame();

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (_snapshots, choices, executor) => {
          if (triggered === 1) {
            executor(choices[0]!);
          }
        },
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        // Player 2 is not relevant for this test.
        () => {},
      );

      timeout(done);
    });

    test.todo(
      'returned choices of triggers are executed. The user only receives all modified states.',
      (done) => {
        // GIVEN
        // We don't want to run into an infinite loop...
        let triggersExecuted = 0;
        class DummyGame extends TestGame {
          triggers() {
            return new Set<Trigger>([
              {
                name: 'Test Trigger',
                apply: () => {
                  if (triggersExecuted++ === 0) {
                    return [
                      new Choice(
                        new TestAction(),
                        this.entities(TestPlayerEntity)[0]!,
                      ),
                    ];
                  }
                },
              },
            ]);
          }
        }

        const game = new DummyGame();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          (snapshots) => {
            // 2 Snapshots were triggered - the initial one and the trigger!
            expect(snapshots).toHaveLength(2);
            // First snapshot was just "spawned".
            expect(snapshots[0]?.executed).toBeUndefined();
            // Second snapshot was triggered by the trigger, so the executed choice is referenced here.
            expect(JSON.parse(JSON.stringify(snapshots[1]?.executed))).toEqual({
              execution: {
                type: 'TestAction',
                parameters: undefined,
              },
              player: '$ENGINE:testPlayerEntity-1',
              preventedBy: undefined,
            });

            done();
          },
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          // Player 2 is not relevant for this test.
          () => {},
        );

        timeout(done);
      },
    );

    test.todo(
      'if there are no choices in a snaphot, an error is thrown.',
      () => {
        // GIVEN
        class DummyGame extends TestGame {
          positiveRules() {
            return new Set<PositiveRule>([
              {
                name: 'test-positive-rule',
                apply: () => {
                  // No choices are generated by this rule, which should cause an error, because the player then has no choice to pick from.
                  return [];
                },
              },
            ]);
          }
        }
        const game = new DummyGame();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          // Player 1 is not relevant for this test.
          () => {},
        );

        // THEN
        expect(() =>
          game.registerPlayerCallback(
            game.entities(TestPlayerEntity)[1]!,
            // Player 2 is not relevant for this test.
            () => {},
          ),
        ).toThrowError(/no choices/gi);
      },
    );

    test.todo(
      'when the game ends through a trigger-executed action, the final snapshot is sent to all players.',
      (done) => {
        // GIVEN
        class EndGameAction extends Action<'EndGameAction'> {
          apply(runtime: ModifiableRuntime): void {
            runtime.end({ winners: [runtime.players()[0]!] });
          }
          public message() {
            return '';
          }
          public prompt() {
            return '';
          }
          public affectedEntities() {}
          public $type: 'EndGameAction' = 'EndGameAction';
        }

        let endTriggered = false;
        class DummyGame extends TestGame {
          triggers() {
            return new Set<Trigger>([
              {
                name: 'Test Trigger',
                apply: (runtime) => {
                  if (!endTriggered) {
                    endTriggered = true;
                    return [
                      new Choice(
                        new EndGameAction(),
                        runtime.entities(TestPlayerEntity)[0]!,
                      ),
                    ];
                  }
                },
              },
            ]);
          }
        }

        const game = new DummyGame();

        let player1Notified = false;
        let player2Notified = false;

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          (_snapshots) => {
            if (game.status() === 'ended') {
              player1Notified = true;
              if (player2Notified) done();
            }
          },
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          (_snapshots) => {
            if (game.status() === 'ended') {
              player2Notified = true;
              if (player1Notified) done();
            }
          },
        );

        timeout(done);
      },
    );
  });

  describe('status', () => {
    test.todo('a game goes through "setup" into "running" status.', (done) => {
      // GIVEN
      const game = new TestGame();

      // THEN
      expect(game.status()).toEqual('setup');

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        // Player 1 is not relevant for this test.
        () => {
          // THEN
          expect(game.status()).toEqual('running');
          done();
        },
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        // Player 2 is not relevant for this test.
        () => {},
      );

      timeout(done);
    });
  });

  describe('end', () => {
    test.todo('a game can end with a winner.', (done) => {
      // GIVEN
      const game = new TestGame();

      // THEN
      expect(game.status()).toEqual('setup');

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        // Player 1 is not relevant for this test.
        () => {
          // THEN
          expect(game.status()).toEqual('running');

          game.end({ winners: [game.entities(TestPlayerEntity)[0]!] });
        },
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        // Player 2 is not relevant for this test.
        () => {
          if (game.status() === 'ended') {
            done();
          }
        },
      );

      timeout(done);
    });

    /* // TODO
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
    */

    test.todo('if the game ends without anything, an error is thrown.', () => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      expect(() => game.end({})).toThrowError();
    });

    test.todo(
      'ignores a game over state if an ended game is ended again.',
      () => {
        // GIVEN
        const game = new TestGame();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          // Player 1 is not relevant for this test.
          () => {},
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          // Player 2 is not relevant for this test.
          () => {},
        );

        game.end({ winners: [game.entities(TestPlayerEntity)[0]!] });
        game.end({ winners: [game.entities(TestPlayerEntity)[1]!] });

        // THEN
        expect(game.endStatus()).toEqual({
          winners: [game.entities(TestPlayerEntity)[0]!], // Not the 2nd player!
          losers: [],
          draws: [],
        });
      },
    );

    /* // TODO
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
    */
  });

  describe('end status', () => {
    test.todo('while the game is starting, end status is undefined.', () => {
      // GIVEN
      const game = new TestGame();

      // THEN
      expect(game.endStatus()).toBeUndefined();

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        // Player 1 is not relevant for this test.
        () => {
          // THEN
          expect(game.endStatus()).toBeUndefined();
        },
      );
    });

    test.todo(
      'returns the correct end status after the game ended.',
      (done) => {
        // GIVEN
        const game = new TestGame();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          // Player 1 is not relevant for this test.
          () => {
            game.end({
              winners: [game.entities(TestPlayerEntity)[0]!],
              losers: [game.entities(TestPlayerEntity)[1]!],
            });

            // THEN
            expect(game.endStatus()).toEqual({
              winners: [game.entities(TestPlayerEntity)[0]!],
              losers: [game.entities(TestPlayerEntity)[1]!],
              draws: [],
            });

            done();
          },
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          // Player 2 is not relevant for this test.
          () => {},
        );

        timeout(done);
      },
    );
  });

  describe('callbacks', () => {
    test.todo('onEnd is called when the game ends.', () => {
      // GIVEN
      const onEnd = mock(() => {});
      const game = new TestGame();
      game.registerCallbacks({ onEnd });

      // WHEN
      expect(onEnd).toHaveBeenCalledTimes(0);
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        // Player 1 is not relevant for this test.
        () => {},
      );
      expect(onEnd).toHaveBeenCalledTimes(0);
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        // Player 2 is not relevant for this test.
        () => {},
      );
      expect(onEnd).toHaveBeenCalledTimes(0);

      // THEN
      expect(onEnd).toHaveBeenCalledTimes(0);

      // GIVEN
      game.end({ winners: [game.entities(TestPlayerEntity)[0]!] });

      // THEN
      expect(onEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('entityClassMapping', () => {
    test.todo('returns the correct mapping.', () => {
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

  describe('setupActions', () => {
    test.todo(
      'setup actions are executed before the first snapshot is sent to players.',
      (done) => {
        // GIVEN
        class GameWithSetup extends TestGame {
          setupActions() {
            return [
              () => {
                this.anyEntity(TestEntityC)!.volatileNumber = 99;
              },
            ];
          }
        }

        const game = new GameWithSetup();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          (snapshots) => {
            // THEN – at least two snapshots: one from the setup action, one with the initial full state / choices
            expect(snapshots).toHaveLength(2);
            // THEN – the setup action already ran, so entity state reflects it
            const entityCDelta = snapshots
              .flatMap((s) => Object.values(s.dirtyEntities))
              .find((e) => (e as any).$type === 'TestEntityC') as any;

            expect(entityCDelta).toBeDefined();
            expect(entityCDelta.volatileNumber).toBe(99);
            done();
          },
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          () => {},
        );

        timeout(done);
      },
    );

    test.todo(
      'setup actions modify state correctly and appear as snapshots before the interactive snapshot.',
      (done) => {
        // GIVEN
        class GameWithSetup extends TestGame {
          setupActions() {
            return [
              () => {
                this.anyEntity(TestEntityC)!.volatileNumber = 42;
              },
            ];
          }
        }

        const game = new GameWithSetup();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          (snapshots) => {
            // THEN – at least two snapshots: one from the setup action, one with the initial full state / choices
            expect(snapshots.length).toBeGreaterThanOrEqual(2);

            // The snapshot produced by the setup action contains the modified entity
            const setupSnapshot = snapshots.find((s) =>
              Object.values(s.dirtyEntities).some(
                (e) => (e as any).volatileNumber === 42,
              ),
            );
            expect(setupSnapshot).toBeDefined();

            // The entity value seen by the player is already 42
            expect(game.anyEntity(TestEntityC)!.volatileNumber).toBe(42);
            done();
          },
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          () => {},
        );

        timeout(done);
      },
    );

    test.todo(
      'setup actions are not called when setupActions() returns void.',
      (done) => {
        // GIVEN – default TestGame returns void from setupActions()
        const pushSpy = spyOn(
          // Access the private _stateService via any cast to verify we never push to the stack from _start
          // Instead we verify observable behaviour: only one snapshot batch is sent (no extra stack processing)
          TestGame.prototype,
          'setupActions',
        );

        const game = new TestGame();

        // WHEN
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[0]!,
          (snapshots) => {
            // THEN – setupActions was called exactly once (during _start)
            expect(pushSpy).toHaveBeenCalledTimes(1);
            // And the snapshot contains the plain initial state (volatileNumber == 0)
            const entityCDelta = snapshots
              .flatMap((s) => Object.values(s.dirtyEntities))
              .find((e) => (e as any).$type === 'TestEntityC') as any;
            expect(entityCDelta?.volatileNumber).toBe(0);
            done();
          },
        );
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          () => {},
        );

        timeout(done);
      },
    );

    test.todo(
      'multiple setup actions are all executed before the first player notification.',
      (done) => {
        // GIVEN
        class GameWithMultipleSetup extends TestGame {
          setupActions() {
            return [
              () => {
                this.anyEntity(TestEntityC)!.volatileNumber += 1;
              },
              () => {
                this.anyEntity(TestEntityC)!.volatileNumber += 10;
              },
            ];
          }
        }

        const game = new GameWithMultipleSetup();

        // WHEN
        game.registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, () => {
          // THEN – both actions ran (LIFO: +10 first, then +1, total = 11)
          expect(game.anyEntity(TestEntityC)!.volatileNumber).toBe(11);
          done();
        });
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          () => {},
        );

        timeout(done);
      },
    );
  });
});
