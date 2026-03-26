import { jest, describe, test, expect, spyOn, afterEach, mock } from 'bun:test';
import { Game } from './game';
import { Action } from './components/action';
import { Entity } from './components/entity';
import { QueryableRuntime } from './interfaces/queryable-runtime';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from './interfaces/player-interface';
import { ClientSnapshotData, Logger } from './game.types';
import { PositiveRule } from './components/positive-rule';
import { timeout } from '../tests/utility.spec';
import { EntityID } from './components/entity.types';
import { Choice } from './components/choice';
import { Trigger } from './components/trigger';

class TestEntityA extends Entity {
  public $type: string = 'TestEntityA';
  constructor(_id: number) {
    super(`testentityA-${_id}`);
  }
}

class TestEntityB extends Entity {
  public $type: string = 'TestEntityB';
  constructor(id: number | string) {
    super(typeof id === 'number' ? `testentityB-${id}` : id);
  }
}

class TestEntityC extends TestEntityB {
  public $type: string = 'TestEntityC';
  public volatileNumber: number = 0;

  constructor(_id: number) {
    super(`testentityC-${_id}`);
  }
}

class TestPlayerEntity extends Entity implements PlayerInterface {
  public $type: string = 'TestPlayerEntity';
  constructor(_id: number) {
    super(`testPlayerEntity-${_id}`);
  }
  [playerInterfaceMarker] = true as const;
}

class TestAction extends Action {
  public message(): string {
    return 'TestAction executed!';
  }
  public prompt(): string {
    return 'Execute TestAction';
  }
  public affectedEntities() {}
  public $type = 'TestAction';
  apply(_runtime: QueryableRuntime): void {
    _runtime.anyEntity<TestEntityC>(TestEntityC)!.volatileNumber++;
  }
}

class TestGame extends Game {
  public name = 'TestGame';

  initialize() {
    const entities = new Set<Entity>();

    entities.add(new TestEntityA(1));
    entities.add(new TestEntityA(2));
    entities.add(new TestEntityA(3));

    entities.add(new TestEntityB(1));
    entities.add(new TestEntityB(2));

    // TestEntityC also should count as TestEntityB since its a subclass!
    entities.add(new TestEntityC(1));

    entities.add(new TestPlayerEntity(1));
    entities.add(new TestPlayerEntity(2));

    return entities;
  }
  positiveRules(): Set<PositiveRule> {
    return new Set<PositiveRule>([
      {
        name: 'test-positive-rule',
        apply: (runtime) =>
          runtime
            .entities(TestPlayerEntity)
            .map((player) => new Choice(new TestAction(undefined), player)),
      },
    ]);
  }
  negativeRules(): void {}
  triggers(): Set<Trigger> | void {}
}

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
      expect(playerInterfaces[0]!.$id).not.toBeNull();
      expect(playerInterfaces[0]!.$id).not.toBeUndefined();
      expect(playerInterfaces[1]!.$id).not.toBeNull();
      expect(playerInterfaces[1]!.$id).not.toBeUndefined();
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
        $id: expect.stringMatching(/testentityA-[1-3]/),
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
              $id: 'testentityA-1',
              $type: 'TestEntityA',
            },
            'testentityA-2': {
              $id: 'testentityA-2',
              $type: 'TestEntityA',
            },
            'testentityA-3': {
              $id: 'testentityA-3',
              $type: 'TestEntityA',
            },
            'testentityB-1': {
              $id: 'testentityB-1',
              $type: 'TestEntityB',
            },
            'testentityB-2': {
              $id: 'testentityB-2',
              $type: 'TestEntityB',
            },
            'testentityC-1': {
              $id: 'testentityC-1',
              volatileNumber: 0,
              $type: 'TestEntityC',
            },
            'testPlayerEntity-1': {
              $id: 'testPlayerEntity-1',
              $type: 'TestPlayerEntity',
            },
            'testPlayerEntity-2': {
              $id: 'testPlayerEntity-2',
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
              $id: 'testentityA-1',
              $type: 'TestEntityA',
            },
            'testentityA-2': {
              $id: 'testentityA-2',
              $type: 'TestEntityA',
            },
            'testentityA-3': {
              $id: 'testentityA-3',
              $type: 'TestEntityA',
            },
            'testentityB-1': {
              $id: 'testentityB-1',
              $type: 'TestEntityB',
            },
            'testentityB-2': {
              $id: 'testentityB-2',
              $type: 'TestEntityB',
            },
            'testentityC-1': {
              $id: 'testentityC-1',
              volatileNumber: 0,
              $type: 'TestEntityC',
            },
            'testPlayerEntity-1': {
              $id: 'testPlayerEntity-1',
              $type: 'TestPlayerEntity',
            },
            'testPlayerEntity-2': {
              $id: 'testPlayerEntity-2',
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
                $id: 'testentityC-1',
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
          playerAtriggered++;

          // This implicitly also tests, that the choice execution here using "executor(...)" does not instantly loop back
          // to the player callback again. The rest of the function should be executed too, otherwise we run into a stack overflow error.
          if (playerAtriggered < 5) {
            executor(Array.from(choices)[0]!);
          } else {
            // THEN
            expect(playerAtriggered).toEqual(5);
            expect(playerBtriggered).toEqual(5 - 1);
            done();
          }
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
                    // TODO: $id is redundant here!
                    $id: 'testentityA-1',
                    // We send the entity type too, so that the client knows how to construct the object of this type again.
                    $type: 'TestEntityA',
                  },
                  'testentityA-2': {
                    $id: 'testentityA-2',
                    $type: 'TestEntityA',
                  },
                  'testentityA-3': {
                    $id: 'testentityA-3',
                    $type: 'TestEntityA',
                  },
                  'testentityB-1': {
                    $id: 'testentityB-1',
                    $type: 'TestEntityB',
                  },
                  'testentityB-2': {
                    $id: 'testentityB-2',
                    $type: 'TestEntityB',
                  },
                  'testentityC-1': {
                    $id: 'testentityC-1',
                    $type: 'TestEntityC',
                    volatileNumber: 0,
                  },
                  'testPlayerEntity-1': {
                    $id: 'testPlayerEntity-1',
                    $type: 'TestPlayerEntity',
                  },
                  'testPlayerEntity-2': {
                    $id: 'testPlayerEntity-2',
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
                      new TestAction(undefined),
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

    test.todo(
      'if there are no choices in a snaphot, an error is thrown.',
      () => {},
    );
    test.todo('a game can end with a winner.', () => {});
    test.todo('a game can end with multiple winners.', () => {});
    test.todo('a game can end with a loser.', () => {});
    test.todo('a game can end with multiple losers.', () => {});
  });
});
