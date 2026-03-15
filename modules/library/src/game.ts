import { Action } from './action';
import { Entity } from './entity';
import { Class, GameParameters, GameState } from './game.types';
import { QueryableRuntime } from './queryable-runtime';

export abstract class Game<
  STATE extends GameState,
  PARAMETERS extends GameParameters | undefined = undefined,
> implements QueryableRuntime<Game<STATE, PARAMETERS>, STATE, PARAMETERS> {
  private _started: boolean = false; // TODO: Is it better to have a fat Game class here? We should maybe divide this class at an earlier point to
  // TODO: ... handle drivers (for MTCS / replays).

  // TODO: Should parameters be serialized within the game, or be discarded after initializing?

  constructor(
    // Parameters are optional, depending on the game.
    ...[parameters]: PARAMETERS extends undefined ? [] : [PARAMETERS]
  ) {
    console.info(() => `Starting game ${this.constructor.name}.`);
    this._start(parameters as PARAMETERS);
  }

  /**
   * Starts the game and validates the initial state.
   * @param parameters The parameters to start the game with.
   */
  private _start(parameters: PARAMETERS): void {
    this.initialize(parameters);
    this._started = true;
  }

  /**
   * The method that initializes the game state.
   * This method should be called by the @link Runtime when the game is started.
   * @param parameters The parameters to initialize the game with.
   * @returns The initial game state.
   */
  abstract initialize(parameters: PARAMETERS): STATE;

  /**
   * The name of the game.
   */
  public abstract readonly name: string;

  abstract enrichen(
    state: STATE,
    runtime: QueryableRuntime<Game<STATE, PARAMETERS>, STATE, PARAMETERS>,
  ): Generator<Entity<STATE>, void, undefined>;

  abstract actions(): Set<Action<STATE, any>>;

  /**
   * Returns all entities that are assignable to a wanted type @param type.
   * @param type The type of entities to return.
   * @returns A set of entities of the wanted type.
   *          If the wanted type is not provided, all entities are returned.
   */
  public entitySet<TYPE extends Entity<STATE>>(
    type: Class<TYPE> | undefined = undefined,
  ): Set<TYPE> {
    if (!this._started) {
      throw new Error('Game has not been started yet.');
    }

    return new Set();
  }

  /**
   * Returns all entities that are assignable to a wanted type @param type.
   * @param type The type of entities to return.
   * @returns An iterable of entities of the wanted type.
   *          If the wanted type is not provided, all entities are returned.
   */
  public entities<TYPE extends Entity<STATE>>(
    type: Class<TYPE> | undefined = undefined,
  ): ReadonlyArray<TYPE> {
    // TODO: Should return Iterable<TYPE>, but filter() does not seem to be supported on that type...?
    if (!this._started) {
      throw new Error('Game has not been started yet.');
    }

    return [];
  }
}
