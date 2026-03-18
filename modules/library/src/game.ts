import { Action } from './action';
import { Entity } from './entity';
import { EntityID } from './entity.types';
import {
  Class,
  DEFAULT_GAME_CONFIG,
  GameConfig,
  GameParameters,
  GameState,
  ResolvedGameConfig,
} from './game.types';
import { QueryableRuntime } from './queryable-runtime';

export abstract class Game<
  STATE extends GameState,
  PARAMETERS extends GameParameters | undefined = undefined,
> implements QueryableRuntime<Game<STATE, PARAMETERS>, STATE, PARAMETERS> {
  private _started: boolean = false; // TODO: Is it better to have a fat Game class here? We should maybe divide this class at an earlier point to
  private _state: STATE = {} as STATE;
  private _logger: ResolvedGameConfig['logger'];

  // TODO: Pass this into a separate component...?
  private _entities = {
    raw: new Set<Entity<STATE>>(), // TODO: Remove raw, since Mapping of "Entity.class" -> Set<Entity> exists already in our Map!
    types: new Map<Class<Entity<STATE>>, Set<Entity<STATE>>>(),
    ids: new Map<EntityID, Entity<STATE>>(),
  };

  // TODO: ... handle drivers (for MTCS / replays).
  // TODO: Should parameters be serialized within the game, or be discarded after initializing?

  constructor(
    // Parameters optional when `PARAMETERS` is `undefined`.
    parameters?: PARAMETERS extends undefined ? undefined : PARAMETERS,
    config: GameConfig = DEFAULT_GAME_CONFIG,
  ) {
    this._logger = {
      ...DEFAULT_GAME_CONFIG.logger,
      ...config.logger,
    } as ResolvedGameConfig['logger']; // FIXME: "as" needed here...?

    this._logger.info(() => `Starting game ${this.constructor.name}.`);
    this._start(parameters as PARAMETERS);
  }

  /**
   * Starts the game and validates the initial state.
   * @param parameters The parameters to start the game with.
   */
  private _start(parameters: PARAMETERS): void {
    const state = this.initialize(parameters);
    this._state = state;

    this._logger.debug(
      () =>
        `Initial state of game ${this.constructor.name}: ${JSON.stringify(state)}`,
    );

    if (
      state === undefined ||
      state === null ||
      typeof state !== 'object' ||
      Object.keys(state).length === 0
    ) {
      throw new Error(
        `Invalid initial state returned by initialize() of game ${this.constructor.name}. Expected an object, but got ${state}.`,
      );
    }

    this._logger.info(() => `Spawning entities...`);
    this._entities = {
      raw: new Set<Entity<STATE>>(),
      types: new Map<Class<Entity<STATE>>, Set<Entity<STATE>>>(),
      ids: new Map<EntityID, Entity<STATE>>(),
    };

    let spawnCount = 0;
    for (const entity of this.enrichen(state, this)) {
      this._entities.raw.add(entity);

      // Set ID -> Entity mapping for extremely quick lookup of entities by singular IDs.
      const id = entity.id();
      this._logger.debug(
        () => `Spawning entity ${entity.constructor.name} with ID ${id}.`,
      );

      if (this._entities.ids.has(id)) {
        throw new Error(
          `Duplicate entity ID ${id}. Entity IDs must be unique.`,
        );
      }
      this._entities.ids.set(id, entity);

      // Set Type -> Entity mapping for quick lookup of entities by type.
      // Since we want individual classes to be respected, but also subclasses
      // (if A extends B, then querying for B should also return A),
      // we need to add the entity to all of its superclasses as well.
      let currentConstructor: unknown = entity.constructor;
      while (
        currentConstructor !== null &&
        currentConstructor !== Object.prototype
      ) {
        if (
          !this._entities.types.has(currentConstructor as Class<Entity<STATE>>)
        ) {
          this._logger.debug(
            () =>
              `Creating new entity type set for type ${currentConstructor?.name}.`,
          );
          this._entities.types.set(
            currentConstructor as Class<Entity<STATE>>,
            new Set(),
          );
        }

        this._entities.types
          .get(currentConstructor as Class<Entity<STATE>>)
          ?.add(entity);

        // Move up the prototype chain to include all superclasses.
        currentConstructor = Object.getPrototypeOf(currentConstructor);
      }
      spawnCount++;
    }

    this._logger.info(() => `Spawned a total of ${spawnCount} entities.`);

    this._started = true;
  }

  // TODO: Entities should be spawnable, if wanted. This would cause a full refresh on the next state evaluation.
  // TODO: Unless the state is empty initially, we only operate on our entity set. A developer may enforce a "refresh" to re-create all entities from the state, if they wish to. This is an expensive operation.

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
    type: Class<TYPE>,
  ): ReadonlySet<TYPE>;
  public entitySet(): ReadonlySet<Entity<STATE>>;
  public entitySet<TYPE extends Entity<STATE>>(
    type?: Class<TYPE>,
  ): ReadonlySet<TYPE> | ReadonlySet<Entity<STATE>> {
    if (!this._started) {
      throw new Error('Game has not been started yet.');
    }

    if (type === undefined) {
      return this._entities.raw;
    }

    const typed = this._entities.types.get(type);
    return typed ?? new Set();
  }

  /**
   * Returns all entities that are assignable to a wanted type @param type.
   * @param type The type of entities to return.
   * @returns An iterable of entities of the wanted type.
   *          If the wanted type is not provided, all entities are returned.
   */
  public entities<TYPE extends Entity<STATE>>(
    type: Class<TYPE>,
  ): ReadonlyArray<TYPE>;
  public entities(): ReadonlyArray<Entity<STATE>>;
  public entities<TYPE extends Entity<STATE>>(
    type?: Class<TYPE>,
  ): ReadonlyArray<TYPE> | ReadonlyArray<Entity<STATE>> {
    if (!this._started) {
      throw new Error('Game has not been started yet.');
    }

    if (type === undefined) {
      return Array.from(this._entities.raw);
    }

    const typed = this._entities.types.get(type);
    return typed ? Array.from(typed) : [];
  }
}
