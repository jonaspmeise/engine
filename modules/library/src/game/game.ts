import { Entity, entityId } from '../components/entity';
import {
  Class,
  DEFAULT_GAME_CONFIG,
  EntityClass,
  EntityClassMapping,
  GameConfig,
  GameEndParameters,
  GameLifecycle,
  GameParameters,
  GameStatus,
  Logger,
  NO_OP_LOGGER,
  PlayerInterfaceCallback,
} from './game.types';
import { QueryableRuntime } from './queryable-runtime';
import { EntityService } from '../services/entity/entity-service';
import {
  PlayerInterface,
  handler,
  isPlayerInterface,
  playerId,
} from '../interfaces/player-interface';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { ModifiableRuntime } from './modifiable-runtime';
import { Action } from '../components/action';
import { Choice, EnhancedChoice } from '../components/choice';
import { StateService } from '../services/state/state-service';

export abstract class Game<
  PARAMETERS extends GameParameters | undefined = undefined,
>
  implements QueryableRuntime, ModifiableRuntime
{
  private _logger: Logger;
  private _status: GameStatus = 'setup';
  private _endParameters: GameEndParameters | undefined = undefined;

  private readonly _entityService: EntityService;
  private readonly _stateService: StateService;
  private readonly _callbacks: Partial<GameLifecycle> = {};

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
    parameters?: PARAMETERS extends undefined ? undefined : PARAMETERS,
    // This parameter is not supplied via a function, because simply instantiating the game already does a lot of
    // heavy lifting which is interesting for the caller to log!
    config: GameConfig = DEFAULT_GAME_CONFIG,
  ) {
    this._logger = {
      ...DEFAULT_GAME_CONFIG.logger,
      ...config.logger,
    };

    this._entityService = new EntityService(
      this._logger,
      this.flush.bind(this),
    );

    this._stateService = new StateService(this._logger);

    this._logger.info(() => `Starting game ${this.constructor.name}.`);
    this._setup(parameters as PARAMETERS);
  }

  /**
   * The method that initializes the game state by spawning all initial entities.
   * This method should be called by the @link Runtime when the game is started.
   * @param parameters The parameters to initialize the game with.
   * @returns The initial game state.
   */
  protected abstract initialize(parameters: PARAMETERS): Set<Entity>;

  /**
   * The maximum depth of the trigger stack. This is used to prevent infinite loops in triggers.
   * If the stack exceeds this depth, an error is thrown.
   * This should be set by the game, depending on how complex the trigger interactions in this game are expected to be.
   * // TODO: This should maybe be passed in the constructor...? It's kinda hidden since it's not abstract here. But overwriting it is only necessarily sparingly.
   */
  public maxDepth: number = 10000;

  /**
   * The name of the game.
   */
  public abstract readonly name: string;

  /**
   * Returns the set of all entity classes that are used in this game.
   * This is necessary so that the client knows how to reconstruct entities sent in snapshots.
   */
  protected abstract entityClasses(): Set<EntityClass<Entity>>;

  /**
   * Returns a mapping of entity type strings to their corresponding classes.
   * This is necessary to reconstruct entities from snapshots, since the snapshot only contains the entity type as a string.
   * The client needs the constructor of the original entity.
   */
  public entityClassMapping(): EntityClassMapping {
    const mapping: EntityClassMapping = {};
    for (const entity of this.entityClasses()) {
      // Because we may use some of our "base entity classes" when representing hidden information,
      // we need to be able to register these abstract classes as well.
      // @ts-expect-error entity may be abstract, but we only call it here to read $type
      const dummy: Entity = new entity(0 as any) as Entity;

      mapping[dummy.$type] = entity;
    }
    return mapping;
  }

  /**
   * Flushes the current state of an entity to the engine.
   * This should be called, when that entity is changed or a new entity is spawned.
   * @param entity The entity to flush.
   */
  public flush(entity: Entity): void {
    this._logger.debug(
      () =>
        `Flushing entity ${entity.constructor.name} with ID ${entity[entityId]} in game ${this.constructor.name}.`,
    );

    this._stateService.markDirty(entity);
  }

  /**
   * Sets up the game and validates the initial state.
   * @param parameters The parameters to set up the game with.
   */
  private _setup(parameters: PARAMETERS): void {
    this._logger.info(() => `Spawning entities...`);

    let spawnCount = 0;
    for (const entity of this.initialize(parameters)) {
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
  public entitySet<TYPE extends Entity>(type: Class<TYPE>): ReadonlySet<TYPE>;
  public entitySet(): ReadonlySet<Entity>;
  public entitySet<TYPE extends Entity>(
    type?: Class<TYPE>,
  ): ReadonlySet<TYPE> | ReadonlySet<Entity> {
    return this._entityService.entitySet(type as Class<Entity>);
  }

  /**
   * Returns all entities that are assignable to a wanted type @param type.
   * @param type The type of entities to return.
   * @returns An iterable of entities of the wanted type.
   *          If the wanted type is not provided, all entities are returned.
   */
  public entities<TYPE extends Entity & PlayerInterface>(
    type: Class<TYPE>,
  ): ReadonlyArray<TYPE & PlayerInterface>;
  public entities<TYPE extends Entity>(type: Class<TYPE>): ReadonlyArray<TYPE>;
  public entities(): ReadonlyArray<Entity>;
  public entities<TYPE extends Entity>(
    type?: Class<TYPE>,
  ): ReadonlyArray<TYPE> | ReadonlyArray<Entity> {
    return this._entityService.entities(type as Class<Entity>);
  }

  /**
   * Returns all registered player entities.
   * @returns The player entities.
   */
  public players(): ReadonlyArray<PlayerEntity> {
    return this._entityService.players();
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
  public anyEntity<TYPE extends Entity>(type: Class<TYPE>): TYPE | null {
    return this._entityService.anyEntity(type);
  }

  public prompt<T extends Choice<Action<string, any, any>>>(
    _player: PlayerInterface,
    _choices: T[],
  ): Promise<T extends Choice<infer A> ? A : never> {
    throw new Error('Method not implemented.');
  }

  /**
   * Starts the actual game loop.
   */
  private _nextSnapshot(): void {
    // Kind of redundant, but does not hurt...
    this._stateService.setSettled(false);

    this._logger.info(
      () =>
        `Calculating next snapshot (depth: ${this._stateService.depth()})...`,
    );

    // Is the game even still running...?
    // TODO: Write test for this!
    if (this._status === 'ended') {
      this._logger.warn(
        `Game ${this.constructor.name} has already ended, but _nextSnapshot was called again. This likely means that some trigger or choice execution was not properly cleaned up after ending the game. Please check your triggers and choice executions to ensure that they do not execute after the game has ended.`,
      );
      return;
    } else {
      this._status = 'running';
    }

    // Did we exceed our maximum depth?
    if (this._stateService.depth() > this.maxDepth) {
      throw new Error(
        `Maximum depth of ${this.maxDepth} exceeded! This likely means there is an infinite loop in your triggers. Please check your triggers and increase the maximum depth (${this.maxDepth}) if necessary.`,
      );
    }

    // Clean up prior snapshot data.
    this._stateService.clear();

    // Work off stack first...
    const target = this._stateService.workOffStack(this);

    if (target !== undefined) {
      this._logger.debug(
        () => `Finished working off stack item, moving to next snapshot...`,
      );

      // @ts-ignore TODO: This is a bit hacky, but we need to check whether the game ended during the execution of a stack item (e.g. a trigger-executed action called end()). If so, we should not execute any further triggers or inform players about choices, but directly send the final snapshot to all players.
      if (this._status !== 'ended') {
        this._nextSnapshot();
      } else {
        // The game ended during a stack item execution (e.g. a trigger-executed action called end()).
        // Inform all players about the final state so they receive the terminal snapshot.
        this._logger.info(
          () =>
            `Game ${this.constructor.name} has ended. Sending final state to all players...`,
        );
        for (const player of this._entityService.players()) {
          this._stateService.informPlayer(
            player,
            this._executePlayerChoice.bind(this),
            false,
          );
        }
      }
      return;
    }

    // Drain queued executed choices.
    const choice = this._stateService.getQueuedChoice();
    if (choice !== undefined) {
      this._executePlayerChoice(choice.player, choice);
    }

    this._stateService.setSettled(true);
  }

  // TODO: This could also belong to the state service...?
  private _executePlayerChoice(
    player: PlayerEntity,
    choice: EnhancedChoice<Action<string, any>>,
  ): void {
    this._stateService.setSettled(false);
    this._logger.info(
      () =>
        `Executing choice ${choice.execution.$type} for player interface with ID ${player[playerId]}...`,
    );

    this._stateService.executePlayerChoice(choice.player, choice, this);
    this._nextSnapshot();
  }

  /**
   * Registers a callback for a player interface, which is used to inform the player about their state and choices.
   * The callback is used to handle the player state.
   * @param player The player interface to register the callback for.
   * @param callback The callback function to handle the player state.
   */
  public registerPlayerCallback(
    player: PlayerEntity,
    callback: PlayerInterfaceCallback,
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
      if (this._status === 'setup') {
        this._start();
      } else {
        this._logger.info(
          () =>
            `Player interface with ID ${player[playerId]} reconnected. Informing them about their state...`,
        );

        this._stateService.informPlayer(
          player,
          this._executePlayerChoice,
          true,
        );
      }
    }
  }

  /**
   * Starts the game.
   */
  private _start(): void {
    this._logger.info(
      () =>
        `All player interfaces have registered a callback. Starting game ${this.constructor.name}.`,
    );

    // Calculate first snapshot.
    this._nextSnapshot();
  }

  // TODO: Maybe move these to another place...
  /**
   * Destroys an entity in the game.
   * @param entity The entity to destroy.
   */
  destroyEntity(entity: Entity): void {
    this._logger.info(
      () =>
        `Destroying entity ${entity.constructor.name} with ID ${entity[entityId]} in game ${this.name}.`,
    );

    this._entityService.destroy(entity);
  }

  /**
   * Spawns a new entity in the game.
   * @param entity The entity to spawn.
   */
  spawnEntity(entity: Entity): void {
    this._logger.info(
      () =>
        `Spawning entity ${entity.constructor.name} with ID ${entity[entityId]} in game ${this.name}.`,
    );

    this._entityService.create(entity);
  }

  /**
   * Returns the current status of the game.
   * There are three possible statuses:
   * - 'setup': The game is being set up, but not all players have registered their callbacks yet. During this phase, no game logic is executed.
   * - 'running': The game is running and players can execute choices.
   * - 'ended': The game has ended and no more choices can be executed.
   * @returns The status of the game.
   */
  status(): Readonly<GameStatus> {
    return this._status;
  }

  end(parameters: Partial<GameEndParameters>): void {
    this._logger.info(() => `Ending game...`);

    if (this._status === 'ended') {
      this._logger.error(
        `Game ${this.constructor.name} has already ended, can't end it again!`,
      );
      return;
    }

    const players = [
      ...(parameters.winners ?? []),
      ...(parameters.losers ?? []),
      ...(parameters.draws ?? []),
    ];

    if (players.length === 0) {
      throw new Error(
        `Cannot end game without any winners, losers or draws! Please provide at least one winner, loser or draw.`,
      );
    }

    // Are there players overlapping in each category?
    const uniquePlayers = new Set(players);
    if (uniquePlayers.size !== players.length) {
      throw new Error(
        `Some players are listed in multiple categories (winners, losers, draws)! Please make sure each player is only listed in one category.`,
      );
    }

    const unregisteredPlayers = players.filter(
      (p) => !this._entityService.players().includes(p),
    );

    if (unregisteredPlayers.length > 0) {
      throw new Error(
        `Cannot end game with unregistered players as winners, losers or draws! Please make sure all players in the end parameters are registered in the game. Unregistered players: ${unregisteredPlayers
          .map((p) => p[entityId])
          .join(', ')}.`,
      );
    }

    this._status = 'ended';
    this._endParameters = {
      winners: parameters.winners ?? [],
      losers: parameters.losers ?? [],
      draws: parameters.draws ?? [],
    };

    // TODO: What happens if the same player is both a winner and a loser?

    if (this._callbacks.onEnd !== undefined) {
      this._callbacks.onEnd(this._endParameters);
    }
  }

  // TODO: Better name!
  endStatus(): GameEndParameters | undefined {
    this._logger.info(
      () => `Checking end status for game ${this.constructor.name}...`,
    );

    return this._endParameters;
  }

  registerCallbacks(callbacks: GameLifecycle): void {
    this._logger.info(
      () =>
        `Registering game lifecycle callback for game ${this.constructor.name}...`,
    );

    Object.assign(this._callbacks, callbacks);
  }

  /**
   * Creates a deep clone of the current game state, suitable for use in MCTS or other lookahead searches.
   * The clone starts in `setup` status with no player callbacks registered.
   * Entity cross-references (fields that point to other entities) are fixed up to use the new cloned proxies.
   * @param config Optional game config for the cloned game — defaults to a no-op logger for silent simulations.
   * @returns A new game instance of the same concrete type with an identical entity state.
   */
  public clone(config: GameConfig = { logger: NO_OP_LOGGER }): this {
    // Step 1: clone every entity, preserving class prototype and all own properties (including symbols).
    const allEntities = Array.from(this.entities());
    const originalToClone = new Map<Entity, Entity>();

    for (const entity of allEntities) {
      const raw = this._entityService.getNonProxy(entity)!;
      const clone = Object.create(Object.getPrototypeOf(raw)) as Entity;
      Object.defineProperties(clone, Object.getOwnPropertyDescriptors(raw));
      originalToClone.set(entity, clone);

      // Remove callbacks on the clone; they will be registered explicitly.
      if (isPlayerInterface(clone)) {
        // @ts-ignore TODO: Fix type
        clone[handler] = undefined as unknown as PlayerInterfaceCallback;
      }
    }

    // Cross-references (e.g. slot.markedBy) are left pointing to live proxies here.
    // They are resolved transparently to the correct cloned proxy at access-time by
    // the entity-service proxy get trap, which canonicalises any entity value through
    // the cloned game's own ids map.

    const clonedEntities = new Set(originalToClone.values());

    // We create a cloned game that simply instantiates the state that we want to have.
    const GameClass = this.constructor;

    class ClonedGame extends (GameClass as any) {
      initialize(_params: unknown): Set<Entity> {
        return clonedEntities;
      }
    }

    return new (ClonedGame as any)(undefined, config) as this;
  }
}
