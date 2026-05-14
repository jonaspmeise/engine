import { describe, test, expect, beforeEach } from 'bun:test';
import { Game } from '../src/game/game';
import { GameParameters } from '../src/game/game.types';
import { Entity, entityId } from '../src/components/entity';
import { Action } from '../src/components/action';
import { ModifiableRuntime } from '../src/game/modifiable-runtime';
import { AfterAnyAction, AfterAction } from '../src/components/lifecyclehooks';
import { Class, EntityClass, NO_OP_LOGGER } from '../src/game/game.types';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../src/interfaces/player-interface';
import { Graph } from '../src/components/graph/graph';
import { timeout } from '../src/utility.spec';
import { Players } from '../src/components/players';
import { GameScenario } from './game-scenario';

export abstract class BaseGameTest<
  PARAMETERS extends GameParameters | undefined = undefined,
> {
  abstract readonly name: string;
  abstract readonly initializer: (parameters: PARAMETERS) => Game<PARAMETERS>;
  abstract readonly parameters: PARAMETERS;
  abstract readonly randomPlayDepth: number;
  abstract readonly numberOfPlayers: number;

  abstract additionalTests(): void;

  protected game!: Game<PARAMETERS>;

  run(): void {
    const self = this;

    describe(this.name, () => {
      beforeEach(() => {
        this.game = self.initializer(self.parameters);
      });

      test('initialize returns more than one entity.', () => {
        // GIVEN / WHEN
        const state = this.game.entities();

        // THEN
        expect(state).toBeDefined();
        expect(state).not.toBeNull();
        expect(state.length).toBeGreaterThan(0);
      });

      test('more than one Entity is spawned initially.', () => {
        // THEN
        expect(this.game.entities().length).toBeGreaterThan(1);
      });

      test(`${this.randomPlayDepth} random plays end in a terminal state and do not throw any errors.`, (done) => {
        // GIVEN / WHEN
        for (let i = 0; i < self.randomPlayDepth; i++) {
          const game = self.initializer(self.parameters);

          game.registerCallbacks({
            onEnd: (status) => {
              console.debug(
                `Random play ${i + 1} ended. ${status.draws.length > 0 ? 'It was a draw.' : `Winner(s): ${status.winners.map((w) => w[entityId]).join(', ')}. Loser(s): ${status.losers.map((l) => l[entityId]).join(', ')}.`}`,
              );

              if (i === self.randomPlayDepth - 1) {
                done();
              }
            },
          });

          for (let player = 0; player < self.numberOfPlayers; player++) {
            game.registerPlayerCallback(
              game.players()[player]!,
              Players.chicken(),
            );
          }
        }

        timeout(done, 10000);
      });

      test('a registered type name -> entity class mapping is given.', () => {
        // THEN
        const mapping = this.game.entityClassMapping();

        expect(mapping).toBeDefined();
        expect(mapping).not.toBeNull();
        expect(Object.keys(mapping).length).toBeGreaterThan(0);
      });

      test('a MCTS player always wins against a random chicken player.', (done) => {
        // GIVEN
        for (let player = 0; player < self.numberOfPlayers - 1; player++) {
          this.game.registerPlayerCallback(
            this.game.players()[player]!,
            Players.chicken(),
          );
        }

        const mctsPlayer = this.game.players()[self.numberOfPlayers - 1]!;
        this.game.registerPlayerCallback(
          mctsPlayer,
          Players.mcts(this.game, mctsPlayer),
        );

        this.game.registerCallbacks({
          onEnd: (status) => {
            // THEN
            expect(status.winners).toHaveLength(1);
            expect(status.winners[0]).toBe(mctsPlayer);
            done();
          },
        });

        timeout(done, 10000);
      });

      this.additionalTests();
    });
  }
}

class DummyPlayer extends Entity implements PlayerInterface {
  public static readonly $type = 'DummyPlayer';
  public override readonly $type = 'DummyPlayer';
  [playerInterfaceMarker] = true as const;
  constructor() {
    super('dummy-player');
  }
  toString() {
    return 'DummyPlayer';
  }
}

class PingAction extends Action<'ping'> {
  public readonly $type = 'ping' as const;
  async doApply(_runtime: ModifiableRuntime): Promise<void> {}
}

class PongAction extends Action<'pong'> {
  public readonly $type = 'pong' as const;
  async doApply(_runtime: ModifiableRuntime): Promise<void> {}
}

class DummyGame extends Game<undefined> {
  public readonly name = 'DummyGame';
  protected initialize(_: undefined): Set<Entity> {
    return new Set([new DummyPlayer()]);
  }
  public rawGraph(): Graph<'INITIAL'> {
    // One-node graph that never self-terminates — used only for direct execute() calls.
    return { INITIAL: async () => {} };
  }
  public actionClasses(): Set<Class<Action<string, any, any>>> {
    return new Set([PingAction, PongAction]);
  }
  protected entityClasses(): Set<EntityClass<Entity>> {
    return new Set([DummyPlayer]);
  }
}

// Fires a PongAction in response to every PingAction — used to test triggered actions.
class TriggerPong extends Entity implements AfterAction<PingAction> {
  public static readonly $type = 'TriggerPong';
  public override readonly $type = 'TriggerPong';
  constructor() {
    super('trigger-pong');
  }
  async afterPing(runtime: ModifiableRuntime): Promise<void> {
    await runtime.execute(new PongAction());
  }
  toString() {
    return 'TriggerPong';
  }
}

class AfterAnyTracker extends Entity implements AfterAnyAction {
  public static readonly $type = 'AfterAnyTracker';
  public override readonly $type = 'AfterAnyTracker';
  public readonly calls: Action<string, any, any>[] = [];
  constructor(id: string) {
    super(id);
  }
  after(_runtime: ModifiableRuntime, action: Action<string, any, any>): void {
    this.calls.push(action);
  }
  toString() {
    return `AfterAnyTracker(${this[entityId]})`;
  }
}

describe('AfterAnyAction', () => {
  test('afterAnyAction is called when an action is executed', async () => {
    const tracker = new AfterAnyTracker('t1');

    await GameScenario.from(new DummyGame(undefined, { logger: NO_OP_LOGGER }))
      .setup((game) => game.spawnEntity(tracker))
      .when(() => new PingAction())
      .run();

    expect(tracker.calls).toHaveLength(1);
    expect(tracker.calls[0]!.$type).toBe('ping');
  });

  test('afterAnyAction is called for every action including triggered ones', async () => {
    const tracker = new AfterAnyTracker('t2');

    const scenario = await GameScenario.from(
      new DummyGame(undefined, { logger: NO_OP_LOGGER }),
    )
      .setup((game) => {
        game.spawnEntity(new TriggerPong());
        game.spawnEntity(tracker);
      })
      .when(() => new PingAction())
      .run();

    expect(scenario.executed()).toHaveLength(2);
    expect(tracker.calls).toHaveLength(2);
    expect(tracker.calls[0]!.$type).toBe('pong');
    expect(tracker.calls[1]!.$type).toBe('ping');
  });

  test('afterAnyAction is not called after its entity is destroyed', async () => {
    const tracker = new AfterAnyTracker('t5');

    await GameScenario.from(new DummyGame(undefined, { logger: NO_OP_LOGGER }))
      .setup((game) => {
        game.spawnEntity(tracker);
        game.destroyEntity(tracker);
      })
      .when(() => new PingAction())
      .run();

    expect(tracker.calls).toHaveLength(0);
  });
});
