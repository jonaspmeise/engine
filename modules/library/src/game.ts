import { Action } from './components/action';
import { Entity } from './components/entity';
import { FlushableRuntime } from './interfaces/flushable-runtime';
import {
  Class,
  DeepReadonly,
  DEFAULT_GAME_CONFIG,
  GameConfig,
  GameParameters,
  GameState,
  Logger,
  PlayerInterfaceCallback,
} from './game.types';
import { QueryableRuntime } from './interfaces/queryable-runtime';
import { EntityService } from './services/entity/entity-service';
import {
  PlayerInterface,
  handler,
  playerId,
} from './interfaces/player-interface';

export abstract class Game<
  STATE extends GameState,
  PARAMETERS extends GameParameters | undefined = undefined,
>
  implements QueryableRuntime<STATE>, FlushableRuntime<STATE>
{
  private _state: STATE = {} as STATE;
  private _logger: Logger;
  private _started: boolean = false;

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
    };

    this._entityService = new EntityService<STATE>(
      this._logger,
      this.flush.bind(this),
    );

    this._logger.info(() => `Starting game ${this.constructor.name}.`);
    this._setup(parameters as PARAMETERS);
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

  /**
   * Provides a mapping from the raw state (JSON) to entities that are more ergonomic to work with.
   * This method should be a generator that yields entities, which are then handled by the engine.
   * @param state The state, from which the entiies should be generated. This is the raw state, as returned by @method initialize, or the state after applying some actions.
   * @param runtime The runtime, which provides access to other entities and game utilities.
   */
  protected abstract enrichen(
    state: STATE,
    runtime: QueryableRuntime<STATE>,
  ): Iterable<Entity<STATE>>;

  /**
   *
   */
  abstract actions(): Set<Action<STATE, any>>;

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
      this._entityService.create(entity);
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
  public anyEntity<TYPE extends Entity<STATE>>(type: Class<TYPE>): TYPE | null {
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
    this._started = true;
    this._logger.info(() => `Calculating next tick...`);

    // FIXME: Implement correctly.
    for (const player of this._entityService.players()) {
      this._informPlayer(player);
    }
  }

  /**
   * Informs a player about their current state.
   * @param player The player to inform about their state.
   * @param sendFullState Whether to send the full state to the player, or only a diff.
   * For example, if a player disconnected and reconnected, they should be informed about their full state.
   * Normally, only the diff is sent.
   */
  private _informPlayer(
    player: PlayerInterface<STATE>,
    sendFullState: boolean = false,
  ): void {
    // TODO: Implement!
    player[handler]!(this.state(), []);
  }

  public registerPlayerCallback(
    player: PlayerInterface<STATE>,
    callback: PlayerInterfaceCallback<STATE>,
  ): void {
    this._logger.info(
      `Registering player callback for player interface with ID ${player[playerId]}.`,
    );

    if (player[handler] !== undefined) {
      this._logger.warn(
        `Player interface with ID ${player[playerId]} already has a registered callback. Overwriting it...`,
      );
    }
    player[handler] = callback;

    // Do all players have a handler? If so, the game can start, since all players "joined".
    const players = this._entityService.players();

    if (players.every((p) => p[handler] !== undefined)) {
      if (!this._started) {
        this._logger.info(
          () =>
            `All player interfaces have registered a callback. Starting game ${this.constructor.name}.`,
        );
        this._nextSnapshot();
      } else {
        this._logger.info(
          () =>
            `Player interface with ID ${player[playerId]} reconnected. Informing them about their state...`,
        );

        this._informPlayer(player, true);
      }
    }
  }

  // TODO: Should one be allowed to _add_ and _remove_ entities during runtime, too?
}
