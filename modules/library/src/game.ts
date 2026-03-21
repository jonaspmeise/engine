import { Action } from './action';
import { Entity } from './entity';
import { EntityID } from './entity.types';
import { FlushableRuntime } from './flushable-runtime';
import {
  Class,
  DeepReadonly,
  DEFAULT_GAME_CONFIG,
  GameConfig,
  GameParameters,
  GameState,
  PlayerInterfaceCallback,
  ResolvedGameConfig,
} from './game.types';
import { QueryableRuntime } from './queryable-runtime';
import { EntityService } from './services/entity-service';
import {
  isPlayerInterface,
  PlayerInterface,
  handler,
  playerId,
} from './player-interface';

export abstract class Game<
  STATE extends GameState,
  PARAMETERS extends GameParameters | undefined = undefined,
>
  implements
    QueryableRuntime<Game<STATE, PARAMETERS>, STATE, PARAMETERS>,
    FlushableRuntime<STATE>
{
  private _state: STATE = {} as STATE;
  private _logger: ResolvedGameConfig['logger'];

  private readonly _entityService: EntityService<STATE>;

  // TODO: Allow cloneable functionality, to mirror a complete game state in preparation for MCTS.
  // TODO: ... handle drivers (for MTCS / replays).
  // TODO: Should parameters be serialized within the game, or be discarded after initializing?

  // TODO: Seed, randomize method, ... for deterministic behavior and testing.

  /**
   * Creates a new game instance and starts it.
   * @param parameters The parameters to start the game with. This is dependent on the game.
   * @param config The configuration for the game.
   */
  constructor(
    // Parameters optional when `PARAMETERS` is `undefined`.
    parameters?: PARAMETERS extends undefined ? undefined : PARAMETERS,
    config: GameConfig = DEFAULT_GAME_CONFIG,
  ) {
    this._logger = {
      ...DEFAULT_GAME_CONFIG.logger,
      ...config.logger,
    } as ResolvedGameConfig['logger']; // FIXME: "as" needed here...?

    this._entityService = new EntityService<STATE>(
      this._logger,
      this.flush.bind(this),
    );

    this._logger.info(() => `Starting game ${this.constructor.name}.`);
    this._setup(parameters as PARAMETERS);
  }

  /**
   * Flushes the current state of an entity to the engine.
   * This should be called, when that entity is changed or a new entity is spawned.
   * @param entity The entity to flush.
   */
  public flush(entity: Entity<STATE>): void {
    this._logger.debug(
      () =>
        `Flushing entity ${entity.constructor.name} with ID ${entity.id()} in game ${this.constructor.name}.`,
    );

    entity.persist(this._state, this);
  }

  /**
   * Sets up the game and validates the initial state.
   * @param parameters The parameters to set up the game with.
   */
  private _setup(parameters: PARAMETERS): void {
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

    let spawnCount = 0;
    for (const entity of this.enrichen(state, this)) {
      this._entityService.spawn(entity);
      spawnCount++;
    }

    // Are any player interfaces spawned?
    // These are necessary to communicate with a player. The player is always part of the game.
    const playerInterfaces = this._entityService.players();

    if (playerInterfaces.length === 0) {
      throw new Error(
        `No entities were spawned that are assignable to the interface "PlayerInterface". Please create entities that implement PlayerInterface, since they are used to communicate with your players.`,
      );
    }

    this._logger.info(() => `Spawned a total of ${spawnCount} entities.`);
  }

  /**
   * The method that initializes the game state.
   * This method should be called by the @link Runtime when the game is started.
   * @param parameters The parameters to initialize the game with.
   * @returns The initial game state.
   */
  protected abstract initialize(parameters: PARAMETERS): STATE;

  /**
   * The name of the game.
   */
  public abstract readonly name: string;

  protected abstract enrichen(
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
    return this._entityService.entitySet(type as Class<Entity<STATE>>);
  }

  /**
   * Returns all entities that are assignable to a wanted type @param type.
   * @param type The type of entities to return.
   * @returns An iterable of entities of the wanted type.
   *          If the wanted type is not provided, all entities are returned.
   */
  public entities<TYPE extends Entity<STATE> & PlayerInterface<STATE>>(
    type: Class<TYPE>,
  ): ReadonlyArray<TYPE & PlayerInterface<STATE>>;
  public entities<TYPE extends Entity<STATE>>(
    type: Class<TYPE>,
  ): ReadonlyArray<TYPE>;
  public entities(): ReadonlyArray<Entity<STATE>>;
  public entities<TYPE extends Entity<STATE>>(
    type?: Class<TYPE>,
  ): ReadonlyArray<TYPE> | ReadonlyArray<Entity<STATE>> {
    return this._entityService.entities(type as Class<Entity<STATE>>);
  }

  /**
   * Returns any entity that is assignable to a wanted type @param type.
   * If there are multiple entities of the wanted type, one of them is returned non-deterministically.
   * Use this method to quickly access an entity of a certain type, where either:
   * - you know only one entity of that type exists, or
   * - it does not matter which entity of that type is returned.
   * If you want to access all entities of a certain type, use @method entities or @method entitySet instead.
   * @param type The type of entity to return.
   * @returns An entity of the wanted type, or null if no such entity exists.
   */
  public entity<TYPE extends Entity<STATE>>(type: Class<TYPE>): TYPE | null {
    return this._entityService.anyEntity(type);
  }

  /**
   * Fetches the raw state object of the game, which is used to communicate with clients.
   * This is a raw object, without any ergonomics provided by entity abstractions.
   * This method should only be used for debugging purposes.
   * Don't modify this state object directly, as it will lead to client desync and inconcistencies.
   * @returns The raw state object of the game.
   */
  public state(): DeepReadonly<STATE> {
    return this._state as DeepReadonly<STATE>;
  }

  /**
   * Starts the actual game loop.
   */
  private _nextSnapshot(): void {
    this._logger.info(() => `Calculating next tick...`);

    // FIXME: Implement correctly.
    for(const player of this._entityService.players()) {
      player[handler]!(this.state(), []);
    }
  }

  public registerPlayerCallback(
    player: PlayerInterface<STATE>,
    callback: PlayerInterfaceCallback<STATE>,
  ): void {
    this._logger.info(
      `Registering player callback for player interface with ID ${player[playerId]}.`,
    );

    player[handler] = callback;

    // Do all players have a handler? If so, the game can start, since all players "joined".
    const players = this._entityService.players();
    // TODO: If a player simply reconnects here, we don't want to issue a new tick.
    // Instead, that player should just be re-informed about their _entire_ state and their choices.
    // No internal transitions of snapshots happen inside the game.
    if (players.every((p) => p[handler] !== undefined)) {
      this._logger.info(
        `All player interfaces have registered a callback. Starting game ${this.constructor.name}.`,
      );
      this._nextSnapshot();
    }
  }
}
