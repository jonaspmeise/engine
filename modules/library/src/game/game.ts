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
  playerId,
} from '../interfaces/player-interface';
import {
  EntityFlushCallbackType,
  PlayerEntity,
} from '../services/entity/entity-service.types';
import { ModifiableRuntime } from './modifiable-runtime';
import { Action } from '../components/action';
import { StateService } from '../services/state/state-service';
import { GraphService } from '../services/graph/graph-service';
import { ComplexGraph, Graph } from '../components/graph/graph';
import { NodeId } from '../components/graph/node.types';
import {
  AfterAnyAction,
  getHook,
  LifecycleType,
} from '../components/lifecyclehooks';

export abstract class Game<
  PARAMETERS extends GameParameters | undefined = undefined,
>
  implements QueryableRuntime, ModifiableRuntime
{
  private _logger: Logger;

  private readonly _entityService: EntityService;
  private _graphService!: GraphService<NodeId>;
  private readonly _stateService: StateService;
  private readonly _callbacks: Partial<GameLifecycle> = {};

  // The number of `execute` calls currently on the call stack. A top-level action raises it to 1;
  // each nested `execute` (e.g. from within an action's apply or a lifecycle trigger) raises it further.
  private _executionDepth: number = 0;
  // The accumulated source-entity ID chain for the currently-executing trigger.
  // null means no trigger is active (direct execution). When a hook belonging to
  // entity E fires and calls runtime.execute(action), this is set to
  // [...parentAction.source, entityId(E)] so the new action records the full chain.
  // Saved and restored around each hook call to support nested trigger chains.
  private _triggerSources: string[] | null = null;

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

    this._entityService =
      config.services?.entityService ??
      new EntityService(this._logger, this.flush.bind(this));
    this._stateService =
      config.services?.stateService ?? new StateService(this._logger);

    this._logger.info(`Starting game ${this.constructor.name}.`);
    this._setup(parameters as PARAMETERS, config.services?.graphService);
  }

  /**
   * The method that initializes the game state by spawning all initial entities.
   * Called during construction to build the initial entity set.
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
   * The graph of the game, which defines the flow of the game.
   * This is only necessary for setting up the initial graph.
   */
  public abstract rawGraph(): Graph<NodeId>;

  /**
   * Returns the set of all action classes that are used in this game.
   * This is needed so that clients know how to reconstruct actions sent in snapshots.
   */
  public abstract actionClasses(): Set<Class<Action<string, any, any>>>;

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
      mapping[entity.$type] = entity;
    }
    return mapping;
  }

  /**
   * Returns the complex graph of the game, with its current state embedded.
   * @returns The complex graph of the game.
   */
  public graph(): ComplexGraph<Graph<NodeId>> {
    return this._graphService.graph();
  }

  /**
   * This method is called, when multiple triggers go off at the same time.
   * @params type The lifecycle type of the triggers, either "before" or "after".
   * @params action The action that triggered the lifecycle hooks.
   * @params entities The entities that have a triggered lifecycle hook.
   * @returns The order in which the triggers should be executed. This should be a permutation of the input entities.
   */
  public resolveTriggerOrder<ACTION extends Action<any, any, any>>(
    type: LifecycleType,
    action: ACTION,
    entities: Entity[],
  ): Entity[] {
    this._logger.warn(
      `Multiple triggers of type "${type}" were triggered at the same time for action "${action.$type}". This can lead to non-deterministic behavior, since the order of execution is not defined. Consider implementing the "resolveTriggerOrder" method in your game to define a deterministic order of execution for these triggers. Returning them in arbitrary order...`,
    );

    return entities;
  }

  /**
   * Flushes the current state of an entity to the engine.
   * This should be called, when that entity is changed or a new entity is spawned.
   * @param entity The entity to flush.
   */
  public flush(entity: Entity, type: EntityFlushCallbackType): void {
    this._logger.debug(
      `Flushing entity ${entity.constructor.name} with ID ${entity[entityId]} in game ${this.constructor.name}.`,
    );

    this._stateService.markDirty(entity, type);
  }

  /**
   * Returns the game status.
   * @returns Either "setup", "running" or "ended", depending on the current status of the game.
   */
  public status(): Readonly<GameStatus> {
    return this._stateService.status();
  }

  /**
   * Returns the current depth of executed actions.
   * Note that this is unrelated to the snapshot depth guarded by @see maxDepth.
   * @returns 0 when no action is being executed, 1 within the execution of a single action
   * (including its lifecycle triggers and player prompts), and one more for each nested execution.
   */
  public depth(): Readonly<number> {
    return this._executionDepth;
  }

  /**
   * Sets up the game and validates the initial state.
   * @param parameters The parameters to set up the game with.
   */
  private _setup(
    parameters: PARAMETERS,
    graphService?: GraphService<NodeId>,
  ): void {
    this._logger.debug(`Setting up game ${this.constructor.name}...`);
    this._logger.debug(`Creating graph service...`);
    this._graphService =
      graphService ?? new GraphService(this.rawGraph(), this._logger);

    this._logger.info(`Spawning entities...`);

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

    this._logger.info(`Spawned a total of ${spawnCount} entities.`);
    this._logger.debug(`Finished setting up game ${this.constructor.name}.`);
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

  public entityById(id: string): Entity | undefined {
    return this._entityService.entityById(id);
  }

  public setCurrentNode(nodeId: NodeId): void {
    this._graphService.setCurrentNode(nodeId);
  }

  public async prompt<ACTION extends Action<string, any, any>>(
    player: PlayerEntity,
    choices: ACTION[],
  ): Promise<ACTION> {
    this._logger.debug(
      `Prompting player ${player[playerId]} with ${choices.length} choices...`,
    );

    // Stamp the active trigger-source chain onto each choice so that the player
    // callback can observe what caused these choices to be offered, even though
    // the choices are not yet executed at this point.
    const promptSource = this._triggerSources ?? [];
    for (const choice of choices) {
      choice.source = promptSource;
    }

    const filteredChoices: ACTION[] = await Promise.all(
      choices.map(async (choice) => {
        if ((await this._actionPreventedBy(choice)) === undefined) {
          return choice;
        }
        return undefined;
      }),
    ).then(
      (results) => results.filter((choice) => choice !== undefined) as ACTION[],
    );

    this._logger.debug(
      `Will prompt player ${player[playerId]} with ${filteredChoices.length} (original: ${choices.length}) choices...`,
    );

    return this._stateService.promptPlayer(player, filteredChoices);
  }

  /**
   * Checks whether there is any entity with a check-hook that prevents a given action from being executed.
   * @param action the action to check.
   * @returns The entity that prevents this action, if such an entity exists, otherwise undefined.
   */
  private async _actionPreventedBy(
    action: Action<string, any, any>,
  ): Promise<Entity | undefined> {
    for (const entity of this._entityService.getHook('check', action)) {
      this._logger.debug(
        `Calling check hook of entity "${entity.$type}" with ID "${entity[entityId]}" for action "${action.$type}"...`,
      );

      if (
        (await getHook(entity, action, 'check')(this, action.parameters)) ===
        false
      ) {
        this._logger.debug(
          `Action "${action.$type}" was prevented by check hook of entity "${entity.$type}" with ID "${entity[entityId]}". Preventing execution of this action...`,
        );
        return entity;
      }
    }

    return undefined;
  }

  /**
   * Executes an action in the game.
   * This is the only way to modify the game state!
   * @param action The action to execute.
   * @returns The executed action, if an action was executed. This may not be the same object as the passed in action,
   * since some properties (or even its complete type!) may be modified during execution due to triggers.
   * Undefined is returned, if the action was prevented.
   */
  public async execute(
    action: Action<string, any, any>,
  ): Promise<Action<string, any, any> | undefined> {
    if (this._stateService.status() === 'ended') {
      this._logger.warn(
        `Trying to execute action "${action.$type}" after the game has already ended. This likely means that some trigger or choice execution was executed after ending the game. Please make sure that this can't happen. Ignoring this action...`,
      );
      return undefined;
    }

    // Record which trigger chain (if any) caused this action to be executed.
    // If we are inside a trigger hook, use the active chain; otherwise preserve any
    // source already stamped by prompt() so that a player-selected choice retains
    // the trigger context it was offered in.
    action.source = this._triggerSources ?? action.source;

    this._stateService.setSettled(false);
    this._logger.debug(`Executing action ${action.$type}...`);

    // Everything belonging to this action (its lifecycle triggers, its apply, prompts issued during it,
    // and nested executions) runs one level deeper than the surrounding context.
    this._executionDepth++;

    try {
      // The action should be registered within the engine, so that clients know abouts its potential existence.
      // If it were not registered, clients might not know how to render it.
      if (
        !this.actionClasses().has(
          action.constructor as Class<Action<string, any, any>>,
        )
      ) {
        this._logger.error(
          `The action type "${action.$type}" is not registered in the game ${this.constructor.name}. Please make sure to include it in the "actionClasses" method of your game, so that clients know how to reconstruct and render this action. Executing it anyway...`,
        );
      }

      // Are there any hooks that prevent this?
      const preventedBy = await this._actionPreventedBy(action);
      if (preventedBy !== undefined) {
        this._logger.info(
          `Action "${action.$type}" was prevented by entity "${preventedBy.$type}" with ID "${preventedBy[entityId]}". Preventing execution of this action...`,
        );
        return undefined;
      }

      // Find all entities that should be called before this action is executed.
      let beforeEntities: Entity[] = this._entityService.getHook(
        'before',
        action,
      );
      
      if (beforeEntities.length > 1) {
        beforeEntities = this.resolveTriggerOrder(
          'before',
          action,
          beforeEntities,
        );
      }

      // Call before hooks.
      for (const entity of beforeEntities) {
        this._logger.debug(
          `Calling before hook of entity "${entity.$type}" with ID "${entity[entityId]}" for action "${action.$type}"...`,
        );

        const savedSources = this._triggerSources;
        this._triggerSources = [...action.source, entity[entityId]];
        let triggerResult;
        try {
          triggerResult = await getHook(
            entity,
            action,
            'before',
          )(this, action.parameters);
        } finally {
          this._triggerSources = savedSources;
        }

        if (triggerResult !== undefined && !triggerResult) {
          this._logger.debug(
            `Action "${action.$type}" was prevented by before hook of entity "${entity.$type}" with ID "${entity[entityId]}". Preventing execution of this action...`,
          );
          return undefined;
        }
      }

      await this._stateService.execute(action, this);

      // Inform player about _this_ action, but before potential after-hooks are called.
      for (const player of this._entityService.players()) {
        this._stateService.informPlayer(player, false);
      }

      // Action from this point on is immutable!
      const immutableAction: typeof action = Object.assign({}, action);
      Object.setPrototypeOf(immutableAction, Object.getPrototypeOf(action));
      Object.freeze(immutableAction.parameters);

      // Find all entities that should be called after this action is executed.
      let afterEntities: Entity[] = this._entityService.getHook(
        'after',
        immutableAction,
      );

      if (afterEntities.length > 1) {
        afterEntities = this.resolveTriggerOrder(
          'after',
          immutableAction,
          afterEntities,
        );
      }

      // Call after hooks.
      for (const entity of afterEntities) {
        this._logger.debug(
          `Calling after hook of entity "${entity.$type}" with ID "${entity[entityId]}" for action "${immutableAction.$type}"...`,
        );

        const savedSources = this._triggerSources;
        this._triggerSources = [...immutableAction.source, entity[entityId]];
        try {
          await getHook(entity, immutableAction, 'after')(
            this,
            immutableAction.parameters,
            immutableAction.returned(),
          );
        } finally {
          this._triggerSources = savedSources;
        }
      }

      // Find all entities that fire after _every_ action, regardless of action type.
      let afterAnyEntities = this._entityService.getAfterAnyHooks();
      if (afterAnyEntities.length > 1) {
        afterAnyEntities = this.resolveTriggerOrder(
          'after',
          immutableAction,
          afterAnyEntities,
        );
      }

      // Call after-any hooks.
      for (const entity of afterAnyEntities) {
        this._logger.debug(
          `Calling after-any hook of entity "${entity.$type}" with ID "${entity[entityId]}" for action "${immutableAction.$type}"...`,
        );

        const savedSources = this._triggerSources;
        this._triggerSources = [...immutableAction.source, entity[entityId]];
        try {
          await (entity as unknown as AfterAnyAction).after(this, immutableAction);
        } finally {
          this._triggerSources = savedSources;
        }
      }

      return action;
    } finally {
      this._executionDepth--;
    }
  }

  /**
   * Starts the actual game loop.
   * @returns A promise that resolves to whether there is a next snapshot to calculate.
   */
  private async _nextSnapshot(): Promise<boolean> {
    // Kind of redundant, but does not hurt...
    this._stateService.setSettled(false);

    this._logger.info(
      `Calculating next snapshot (depth: ${this._stateService.depth()})...`,
    );

    // Is the game even still running...?
    // TODO: Write test for this!
    if (this._graphService.isEnded()) {
      this._logger.warn(
        `Game ${this.constructor.name} has already ended, but _nextSnapshot was called again. This likely means that some trigger or choice execution was not properly cleaned up after ending the game. Please check your triggers and choice executions to ensure that they do not execute after the game has ended.`,
      );
      return false;
    }

    // Did we exceed our maximum depth?
    if (this._stateService.depth() > this.maxDepth) {
      throw new Error(
        `Maximum depth of ${this.maxDepth} exceeded! This likely means there is an infinite loop in your triggers. Please check your triggers and increase the maximum depth (${this.maxDepth}) if necessary.`,
      );
    }

    // Clean up prior snapshot data.
    this._stateService.clear();

    // Executing current graph node!
    await this._graphService.execute(this);

    // Drain queued executed choices.
    const choice = this._stateService.getQueuedChoice();
    if (choice !== undefined) {
      await this.execute(choice.execution);
    }

    this._stateService.setSettled(true);

    if (this._graphService.isEnded()) {
      this._stateService.setStatus('ended');
    }

    // The graph execution should also stop, if the game was ended during an execution using the "end()" method.
    return this._stateService.status() !== 'ended';
  }

  /**
   * Registers a callback for a player interface, which is used to inform the player about their state and choices.
   * The callback is used to handle the player state.
   * @param player The player interface to register the callback for.
   * @param callback The callback function to handle the player state.
   * @returns a promise that resolved when handling the registration of the player callback is finished.
   */
  public async registerPlayerCallback(
    player: PlayerEntity,
    callback: PlayerInterfaceCallback,
  ): Promise<void> {
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
      if (this._stateService.status() === 'setup') {
        await this._start();
      } else {
        this._logger.info(
          () =>
            `Player interface with ID ${player[playerId]} reconnected. Informing them about their state...`,
        );

        this._stateService.informPlayer(player, true);
        this._stateService.repromptPlayer(player);
      }
    }
  }

  /**
   * Starts the game.
   * @returns A promise that resolves when the game has finished starting and the first snapshot was calculated.
   */
  private async _start(): Promise<void> {
    this._logger.info(
      `All player interfaces have registered a callback. Starting game ${this.constructor.name}.`,
    );
    this._stateService.setStatus('running');

    // Inform players about initial state.
    // Kind of redundant, but does not hurt...
    this._stateService.setSettled(false);

    this._logger.debug(`Informing players about initial state...`);
    for (const player of this._entityService.players()) {
      this._stateService.informPlayer(player, true);
    }

    // Calculate first node.
    while (await this._nextSnapshot()) {}
  }

  // TODO: Maybe move these to another place...
  /**
   * Destroys an entity in the game.
   * @param entity The entity to destroy.
   */
  destroyEntity(entity: Entity): void {
    this._logger.info(
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
      `Spawning entity ${entity.constructor.name} with ID ${entity[entityId]} in game ${this.name}.`,
    );

    this._entityService.create(entity);
  }

  end(parameters: Partial<GameEndParameters>): void {
    this._logger.info(`Ending game...`);

    if (this._stateService.status() === 'ended') {
      this._logger.error(
        `Game ${this.constructor.name} has already ended, can't end it again!`,
      );
      return;
    }

    this._logger.debug(
      `Winners are: ${parameters.winners?.map((p) => p[entityId]).join(', ') ?? 'none'}.`,
    );
    this._logger.debug(
      `Losers are: ${parameters.losers?.map((p) => p[entityId]).join(', ') ?? 'none'}.`,
    );
    this._logger.debug(
      `Draws are: ${parameters.draws?.map((p) => p[entityId]).join(', ') ?? 'none'}.`,
    );

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

    const undefinedPlayers = players.filter((p) => p === undefined);
    if (undefinedPlayers.length > 0) {
      throw new Error(`Cannot end game with "undefined" players as winners, losers or draws! Please make sure all players in the end parameters are defined.
        Winners were: ${parameters.winners?.map((p) => p[entityId]).join(', ') ?? 'none'},
        Losers were: ${parameters.losers?.map((p) => p[entityId]).join(', ') ?? 'none'},
        Draws were: ${parameters.draws?.map((p) => p[entityId]).join(', ') ?? 'none'}.`);
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

    this._stateService.setEndParameters({
      winners: parameters.winners ?? [],
      losers: parameters.losers ?? [],
      draws: parameters.draws ?? [],
    });
    this._stateService.setStatus('ended');

    if (this._callbacks.onEnd !== undefined) {
      this._callbacks.onEnd(this._stateService.endStatus()!);
    }
  }

  // TODO: Better name!
  endStatus(): GameEndParameters | undefined {
    this._logger.info(
      `Checking end status for game ${this.constructor.name}...`,
    );

    return this._stateService.endStatus();
  }

  registerCallbacks(callbacks: GameLifecycle): void {
    this._logger.info(
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
    const cloneLogger: Logger = {
      ...DEFAULT_GAME_CONFIG.logger,
      ...config.logger,
    };
    const GameClass = this.constructor;
    const clonedRawEntities = this._entityService.cloneRawEntities();
    const clonedGraphService = this._graphService.clone(cloneLogger);
    const clonedStateService = this._stateService.clone(cloneLogger);

    class ClonedGame extends (GameClass as any) {
      initialize(_params: unknown): Set<Entity> {
        return clonedRawEntities;
      }
    }

    return new (ClonedGame as any)(undefined, {
      ...config,
      services: {
        graphService: clonedGraphService,
        stateService: clonedStateService,
      },
    }) as this;
  }
}
