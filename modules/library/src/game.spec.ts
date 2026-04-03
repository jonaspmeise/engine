import { jest, describe, test, expect, spyOn, afterEach, mock } from 'bun:test';
import { Action } from './components/action';
import { Entity, entityId } from './components/entity';
import { ClientSnapshotData, Logger, NO_OP_LOGGER } from './game.types';
import { PositiveRule } from './components/positive-rule';
import { timeout } from './utility.spec';
import { EntityID } from './components/entity.types';
import { Choice } from './components/choice';
import { Trigger } from './components/trigger';
import {
  TestGame,
  TestEntityA,
  TestPlayerEntity,
  TestEntityB,
  TestEntityC,
  TestAction,
} from './game.spec.types';

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
    test('calls initialize on game instantiation.', () => {
      // GIVEN when we instantiate an instance of our Testgame, initialize is called once.
      const initializeMock = spyOn(TestGame.prototype, 'initialize');

      // WHEN
      new TestGame();

      // THEN
      expect(initializeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('initialize', () => {
    test('throws an error if a game without any positive rule is initialized.', () => {
      // GIVEN / WHEN / THEN
      class NoPositiveRuleGame extends TestGame {
        positiveRules(): Set<PositiveRule> {
          return new Set<PositiveRule>();
        }
      }

      expect(() => new NoPositiveRuleGame()).toThrowError(
        /no positive rules/gi,
      );
    });

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

  describe('entitySet', () => {
    test('enriches the game with entities returned by the enrichen generator.', () => {
      // GIVEN / WHEN
      const game = new TestGame();

      // THEN
      expect(game.entitySet()).toHaveLength(8);
      expect(game.entitySet(TestEntityA)).toHaveLength(3);
      expect(game.entitySet(TestEntityB)).toHaveLength(3); // 2x TestEntityB + 1x TestEntityC
      expect(game.entitySet(TestEntityC)).toHaveLength(1);
      expect(game.entitySet(TestPlayerEntity)).toHaveLength(2);
    });
  });

  describe('entity', () => {
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
          },
        ),
      ).toBeNull();
    });
  });

  describe('entities', () => {
    test('enriches the game with entities returned by the enrichen generator.', () => {
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
    test('when an entity is spawned, and that entity is modified, it is flushed.', () => {
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

      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        () => {},
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        () => {},
      );

      // THEN #1
      expect(logger.warn).toHaveBeenCalledTimes(0);

      // WHEN
      // The same player interface is overwritten!
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        () => {},
      );

      // THEN #2
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/overwrit/gi),
      );
    });

    test('the game does not start the game until all players interfaces have handlers registered.', () => {
      // GIVEN
      const game = new TestGame();

      const player1Callback = mock(() => {});
      const player2Callback = mock(() => {});

      // WHEN #1
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );

      // THEN #1
      expect(player1Callback).toHaveBeenCalledTimes(0);
      expect(player2Callback).toHaveBeenCalledTimes(0);

      // WHEN #2
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        player2Callback,
      );

      // THEN #2
      expect(player1Callback).toHaveBeenCalledTimes(1);
      expect(player2Callback).toHaveBeenCalledTimes(1);
    });

    test('starts the game when all player interfaces have handlers registered.', () => {
      // GIVEN
      const game = new TestGame();

      const playerCallback1 = mock(() => {});
      const playerCallback2 = mock(() => {});

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        playerCallback1,
      );

      expect(playerCallback1).toHaveBeenCalledTimes(0);
      expect(playerCallback2).toHaveBeenCalledTimes(0);

      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        playerCallback2,
      );

      // THEN
      expect(playerCallback1).toHaveBeenCalledTimes(1);
      expect(playerCallback2).toHaveBeenCalledTimes(1);
    });

    test('if a player interface registers a callback while the game is already running, only the callback is replaced.', () => {
      // GIVEN
      const player1Callback = mock(() => {});
      const player2Callback = mock(() => {});

      const game = new TestGame();
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        player2Callback,
      );

      // THEN #1
      expect(player1Callback).toHaveBeenCalledTimes(1);
      expect(player2Callback).toHaveBeenCalledTimes(1);

      // WHEN
      // A single player callback is overwritten, maybe because the client disconnected and reconnected.
      // In this case, the second player should not be informed about this, and only the reconnected
      // player should be informed about their state again.
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        player1Callback,
      );

      // THEN
      expect(player1Callback).toHaveBeenCalledTimes(2);
      expect(player2Callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle', () => {
    test('no empty deltas are transmitted.', (done) => {
      // GIVEN
      let triggered = 0;
      class DummyGame extends TestGame {
        triggers(): Set<Trigger> | void {
          return new Set<Trigger>([
            {
              apply: (runtime) => {
                triggered++;

                if (triggered < 10) {
                  return [
                    // TODO: We have to modify state here, otherwise our trigger creates an empty snapshot after all.
                    // TODO: This should be fixed by just checking the dirty entities before and after each trigger execution to check,
                    // whether this trigger actually modified any state.
                    () => {
                      runtime.anyEntity<TestEntityC>(TestEntityC)!
                        .volatileNumber++;
                    },
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
        game.players()[0]!,
        (snapshots, choices, execute) => {
          expect(snapshots).toBeDefined();
          expect(snapshots.length).toBeGreaterThan(0);
          expect(
            snapshots.every(
              (snapshot) => Object.keys(snapshot.dirtyEntities).length > 0,
            ),
          ).toBe(true);

          if (choices.length > 0 && triggered < 10) {
            execute(choices[0]!);
          }

          done();
        },
      );

      game.registerPlayerCallback(game.players()[1]!, () => {});
    });

    test('delayed choice executions are handled correctly.', (done) => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      let triggered = 0;
      game.registerPlayerCallback(
        game.players()[0]!,
        (_snapshots, choices, execute) => {
          if (choices.length > 0 && triggered == 0) {
            setTimeout(() => {
              triggered++;
              execute(choices[0]!);
            }, 50);
          }

          if (triggered === 1) {
            done();
          }
        },
      );
      game.registerPlayerCallback(
        game.players()[1]!,
        // Player 2 is not relevant for this test.
        () => {},
      );

      timeout(done, 100);
    });

    test('throws an error after a state depth of 10000 (or given depth) has reached.', () => {
      // GIVEN
      class DummyGame extends TestGame {
        public maxDepth = 3;
      }

      const game = new DummyGame();

      // WHEN
      let choiceExecutionCount = 0;
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (_snapshots, choices, executor) => {
          choiceExecutionCount++;
          executor(choices[0]!);
        },
      );
      expect(() =>
        game.registerPlayerCallback(
          game.entities(TestPlayerEntity)[1]!,
          // Player 2 is not relevant for this test.
          () => {},
        ),
      ).toThrowError(/maximum.+depth/gi);
      expect(choiceExecutionCount).toEqual(4);
    });

    test('logs an error if two players have a choice at the same time.', (done) => {
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
    });

    test('the game starts when all player interfaces have registered a callback. players are informed about the initial state.', (done) => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      let player1Informed = false;
      let player2Informed = false;

      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (snapshots, choices) => {
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

          expect(choices).toBeDefined();
          expect(choices).toHaveLength(1);

          player1Informed = true;
          if (player2Informed) {
            done();
          }
        },
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        (snapshots, choices) => {
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

          expect(choices).toBeDefined();
          expect(choices).toHaveLength(1);

          player2Informed = true;
          if (player1Informed) {
            done();
          }
        },
      );
    });

    test('sends only modified entities of the state to the player after a choice is picked. choices reset.', (done) => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      let snapshotCount = 0;

      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (snapshots, choices, executor) => {
          snapshotCount++;

          if (snapshotCount === 1) {
            // Initial state - pick a choice!
            executor(Array.from(choices)[0]!);
          } else {
            // THEN
            // Only the modified entity should be sent to the player, not the whole state!
            expect(choices).toHaveLength(1);
            expect(snapshots).toHaveLength(1);
            expect(snapshots[0]?.dirtyEntities).toEqual({
              'testentityC-1': {
                [entityId]: 'testentityC-1',
                // The action modified this property!
                volatileNumber: 1,
                $type: 'TestEntityC',
              },
            });

            done();
          }
        },
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        // Player 2 is not relevant for this test.
        (_snapshots, _choices) => {},
      );

      timeout(done);
    });

    test('if a choice is executed that does not exist, an error is logged and nothing happens.', (done) => {
      // GIVEN
      const game = new TestGame(undefined, { logger });

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (_snapshots, _choices, executor) => {
          // THEN
          executor('non-existing-choice-id');

          expect(logger.error).toHaveBeenCalledWith(
            expect.stringMatching(/non-existing-choice-id/gi),
          );
          done();
        },
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        // Player 2 is not relevant for this test.
        (_snapshots, _choices) => {},
      );

      timeout(done);
    });

    test('if a player executes a choice of another player, an error is logged and nothing happens.', (done) => {
      // GIVEN
      const game = new TestGame(undefined, { logger });

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (_snapshots, _choices, executor) => {
          // THEN
          executor('choice-1');
          expect(logger.error).toHaveBeenCalledWith(
            expect.stringMatching(/invalid.+choice/gi),
          );
          done();
        },
      );
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[1]!,
        // Player 2 is not relevant for this test.
        (_snapshots, _choices) => {},
      );

      timeout(done);
    });

    test('if a player instantly executes a choice in-memory, the other player is atleast notified about the state change.', (done) => {
      // GIVEN
      const game = new TestGame();

      let playerAtriggered = 0;
      let playerBtriggered = 0;

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,

        (_snapshots, choices, executor) => {
          // This implicitly also tests, that the choice execution here using "executor(...)" does not instantly loop back
          // to the player callback again. The rest of the function should be executed too, otherwise we run into a stack overflow error.
          if (playerAtriggered < 5) {
            executor(Array.from(choices)[0]!);
          } else {
            // THEN
            expect(playerAtriggered).toEqual(5);
            expect(playerBtriggered).toEqual(5);
            done();
          }

          playerAtriggered++;
        },
      );
      game.registerPlayerCallback(game.entities(TestPlayerEntity)[1]!, () => {
        playerBtriggered++;
      });

      timeout(done);
    });

    test('the serialized state sent to the player is correct.', (done) => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (snapshots, choices) => {
          // THEN
          const data: ClientSnapshotData = {
            snapshots: snapshots,
            choices: choices,
          };

          expect(JSON.parse(JSON.stringify(data))).toEqual({
            snapshots: [
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
            ],
            choices: [
              {
                id: 'choice-0',
                execution: {
                  type: 'TestAction',
                  // TODO: Player does not need to be serialized, because the client knows that this choice only belongs to them.
                  // But for choices in the snapshots, the player is relevant...
                },
                player: '$ENGINE:testPlayerEntity-1',
              },
            ],
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
    });

    test('referenced entities in choices are serialized using a placeholder.', (done) => {
      // GIVEN
      class TargetedAction extends Action<{
        target: Entity;
        nested: { target: Entity };
      }> {
        apply(): void {
          // Not relevant for this test.
        }
        public $type: string = 'TargetedAction';
        public prompt(): string {
          return 'Execute TargetedAction';
        }
        public affectedEntities(): EntityID[] | void {
          throw new Error('Method not implemented.');
        }
        public message(): string {
          return 'TargetedAction executed!';
        }
      }

      class DummyGame extends TestGame {
        positiveRules() {
          return new Set<PositiveRule>([
            {
              name: 'test-positive-rule',
              apply: (runtime) => {
                const entityC = runtime.anyEntity(TestEntityC)!;

                return [
                  new Choice(
                    new TargetedAction({
                      target: entityC,
                      nested: { target: entityC },
                    }),
                    runtime.entities(TestPlayerEntity)[0]!,
                  ),
                ];
              },
            },
          ]);
        }
      }
      const game = new DummyGame();

      // WHEN
      game.registerPlayerCallback(
        game.entities(TestPlayerEntity)[0]!,
        (_snapshots, _choices) => {
          // THEN
          expect(JSON.parse(JSON.stringify(_choices))).toEqual([
            {
              id: 'choice-0',
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
            },
          ]);

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

    test('triggers are passed the correct prior executed action.', (done) => {
      // GIVEN
      let triggerExecuted = false;

      class DummyGame extends TestGame {
        triggers() {
          return new Set<Trigger>([
            {
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
    });

    test('triggers are executed after in the initial game state.', (done) => {
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
    });

    test('triggers are executed after every picked choice.', (done) => {
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

    test('returned choices of triggers are executed. The user only receives all modified states.', (done) => {
      // GIVEN
      // We don't want to run into an infinite loop...
      let triggersExecuted = 0;
      class DummyGame extends TestGame {
        triggers() {
          return new Set<Trigger>([
            {
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
    });

    test('if there are no choices in a snaphot, an error is thrown.', () => {
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
    });
  });

  describe('status', () => {
    test('a game goes through "setup" into "running" status.', (done) => {
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
    test('a game can end with a winner.', (done) => {
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

    test('if the game ends without anything, an error is thrown.', () => {
      // GIVEN
      const game = new TestGame();

      // WHEN
      expect(() => game.end({})).toThrowError();
    });

    test('ignores a game over state if an ended game is ended again.', () => {
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
        () => {
          // THEN
          expect(game.endStatus()).toBeUndefined();
        },
      );
    });

    test('returns the correct end status after the game ended.', (done) => {
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
