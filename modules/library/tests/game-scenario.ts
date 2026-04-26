import { Action } from '../src/components/action';
import { EnhancedChoice } from '../src/components/choice';
import { Game } from '../src/game/game';
import {
  GameEndParameters,
  GameParameters,
  PlayerInterfaceCallback,
} from '../src/game/game.types';
import { PlayerEntity } from '../src/services/entity/entity-service.types';

/**
 * The type of the choices array passed to a selector function.
 * Exported so tests can annotate helper functions without verbose generics.
 */
export type ChoiceSelector = EnhancedChoice<Action<string, any, any>>[];

class ScriptedPlayer {
  private readonly _queue: Array<{
    selector: (
      choices: ChoiceSelector,
    ) => EnhancedChoice<Action<string, any, any>> | undefined;
    isStop: boolean;
  }> = [];

  public enqueue(
    selector: (
      choices: ChoiceSelector,
    ) => EnhancedChoice<Action<string, any, any>> | undefined,
    isStop: boolean,
  ): this {
    this._queue.push({ selector, isStop });
    return this;
  }

  public toCallback(game: Game<any>): PlayerInterfaceCallback {
    const queue = this._queue;
    return {
      state: () => {},
      prompt: (choices, execute) => {
        const entry = queue.shift();
        if (!entry) {
          execute(choices[0]!);
          return;
        }
        const result = entry.selector(choices as ChoiceSelector);
        if (entry.isStop) {
          game.end({ draws: game.players() as PlayerEntity[] });
          execute(choices[0]!);
        } else {
          execute(result!);
        }
      },
    };
  }

  public static fallback(): PlayerInterfaceCallback {
    return {
      state: () => {},
      prompt: (choices, execute) => {
        if (choices.length > 0) execute(choices[0]!);
      },
    };
  }
}

/**
 * A builder that lets you compose a specific game scenario, run it, and then assert on the outcome.
 * Use `when()` to script a player's choice for one prompt turn.
 * Return `StopScenario` from a selector to end the game cleanly at that point.
 *
 * @example
 * ```ts
 * await GameScenario.from(game)
 *   .when(playerX, (choices) => choices.find((c) => c.execution.parameters.slot === slot)!)
 *   .run();
 * expect(slot.markedBy).toBe(playerX);
 * ```
 */
export class GameScenario<
  PARAMETERS extends GameParameters | undefined = undefined,
> {
  private readonly _setupCallbacks: Array<(game: Game<PARAMETERS>) => void> =
    [];
  private readonly _atomicActions: Array<
    (game: Game<PARAMETERS>) => Action<string, any, any>
  > = [];
  private readonly _scriptedPlayerQueue: Array<{
    lookup: PlayerEntity | (() => PlayerEntity);
    selector: (
      choices: ChoiceSelector,
    ) => EnhancedChoice<Action<string, any, any>> | undefined;
    isStop: boolean;
  }> = [];
  private readonly _executedActions: Action<string, any, any>[] = [];
  private readonly _promptCounts = new Map<PlayerEntity, number>();

  private constructor(private readonly _game: Game<PARAMETERS>) {}

  public static from<P extends GameParameters | undefined>(
    game: Game<P>,
  ): GameScenario<P> {
    return new GameScenario(game);
  }

  /**
   * Skips to a specific graph node instead of starting at INITIAL.
   * Useful for testing a mid-game graph state without subclassing the game.
   */
  public withGraphNode(nodeId: string): this {
    this._setupCallbacks.unshift((game) => game.setCurrentNode(nodeId));
    return this;
  }

  public get game(): Game<PARAMETERS> {
    return this._game;
  }

  /**
   * Directly mutates game state before execution begins — the GIVEN condition.
   * Runs before any when() actions, so entity references captured here are safe
   * to use inside lazy when(factory) callbacks.
   */
  public setup(callback: (game: Game<PARAMETERS>) => void): this {
    this._setupCallbacks.push(callback);
    return this;
  }

  /**
   * Queues an atomic action to be executed directly via game.execute().
   * The factory receives the game and returns the action to run.
   * Atomic actions are executed before the game loop starts.
   * If the game ends during execution (e.g. a triggered win), the loop is skipped.
   */
  public when(
    factory: (game: Game<PARAMETERS>) => Action<string, any, any>,
  ): this;
  /**
   * Queues a choice selection for one prompt turn of the given player.
   * `player` can be an eager entity reference OR a zero-arg factory — useful when
   * the player reference is captured inside a setup() callback.
   */
  public when(
    player: PlayerEntity | (() => PlayerEntity),
    selector: (
      choices: ChoiceSelector,
    ) => EnhancedChoice<Action<string, any, any>>,
  ): this;
  public when(
    arg:
      | PlayerEntity
      | (() => PlayerEntity)
      | ((game: Game<PARAMETERS>) => Action<string, any, any>),
    selector?: (
      choices: ChoiceSelector,
    ) => EnhancedChoice<Action<string, any, any>>,
  ): this {
    if (selector === undefined) {
      // No selector → atomic action factory overload.
      this._atomicActions.push(
        arg as (game: Game<PARAMETERS>) => Action<string, any, any>,
      );
    } else {
      // Player + selector → game loop overload. Player may be lazy (resolved after setup).
      this._scriptedPlayerQueue.push({
        lookup: arg as PlayerEntity | (() => PlayerEntity),
        selector,
        isStop: false,
      });
    }
    return this;
  }

  /**
   * Stops the scenario cleanly when the given player is next prompted.
   * An optional observer receives the choices before the game ends — useful for capturing
   * what was offered without needing to select one.
   */
  public stop(
    player: PlayerEntity | (() => PlayerEntity),
    observer?: (choices: ChoiceSelector) => void,
  ): this {
    this._scriptedPlayerQueue.push({
      lookup: player,
      selector: (choices) => {
        observer?.(choices);
        return undefined;
      },
      isStop: true,
    });
    return this;
  }

  /**
   * Runs the scenario:
   * 1. Applies setup() callbacks (direct state mutation).
   * 2. Executes atomic when(factory) actions in order.
   * 3. If the game has not ended, starts the game loop via registerPlayerCallback.
   *
   * Returns `this` so assertions can be chained on the result.
   */
  public async run(): Promise<this> {
    // Intercept game.execute so every action (including those triggered internally
    // by after-hooks) is recorded.  We push tentatively before awaiting so that
    // nested executions appear in the array in the order they were *started*, not
    // the order they *completed* (outer action completes after inner ones).
    const originalExecute = this._game.execute.bind(this._game);
    (this._game as any).execute = async (action: Action<string, any, any>) => {
      const index = this._executedActions.length;
      this._executedActions.push(action); // tentative slot
      const result = await originalExecute(action);
      if (result === undefined) {
        this._executedActions.splice(index, 1); // prevented — remove
      } else {
        this._executedActions[index] = result; // swap in the immutable copy
      }
      return result;
    };

    // Step 1: direct state mutation (GIVEN).
    for (const cb of this._setupCallbacks) {
      cb(this._game);
    }

    // Step 2: atomic actions (WHEN).
    for (const factory of this._atomicActions) {
      if (this._game.status() === 'ended') break;
      await (this._game as any).execute(factory(this._game));
    }

    // Step 3: game loop (only if not already ended by the atomic actions).
    if (this._game.status() !== 'ended') {
      // Resolve lazy player references now that setup() has populated them.
      const scriptedPlayers = new Map<PlayerEntity, ScriptedPlayer>();
      for (const { lookup, selector, isStop } of this._scriptedPlayerQueue) {
        const player = typeof lookup === 'function' ? lookup() : lookup;
        if (!scriptedPlayers.has(player)) {
          scriptedPlayers.set(player, new ScriptedPlayer());
        }
        scriptedPlayers.get(player)!.enqueue(selector, isStop);
      }

      for (const player of this._game.players()) {
        const scripted = scriptedPlayers.get(player);
        const rawCallback = scripted
          ? scripted.toCallback(this._game)
          : ScriptedPlayer.fallback();

        // Wrap prompt to track how many times each player was prompted.
        const callback: PlayerInterfaceCallback = {
          state: rawCallback.state,
          prompt: (choices, execute) => {
            this._promptCounts.set(
              player,
              (this._promptCounts.get(player) ?? 0) + 1,
            );
            rawCallback.prompt(choices, execute);
          },
        };

        await this._game.registerPlayerCallback(player, callback);
      }
    }

    return this;
  }

  /** All actions executed during this scenario, in the order they were applied. */
  public executed(): ReadonlyArray<Action<string, any, any>> {
    return this._executedActions;
  }

  /** The game's end status, or undefined if the game has not ended. */
  public endStatus(): GameEndParameters | undefined {
    return this._game.endStatus();
  }

  /**
   * The number of times the given player was prompted for a choice during run().
   * Returns 0 when the scenario ran in atomic mode (no game loop was started).
   */
  public promptCount(player: PlayerEntity): number {
    return this._promptCounts.get(player) ?? 0;
  }
}
