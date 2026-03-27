import { Entity, entityId } from './components/entity';
import { FlushableRuntime } from './interfaces/flushable-runtime';
import {
  Class,
  DEFAULT_GAME_CONFIG,
  GameConfig,
  GameParameters,
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
import { PositiveRule } from './components/positive-rule';
import { NegativeRule } from './components/negative-rule';
import { ChoiceService } from './services/choices/choice-service';
import { PlayerEntity } from './services/entity/entity-service.types';
import { ModifiableRuntime } from './interfaces/modifiable-runtime';
import { Trigger, TriggerReturnType } from './components/trigger';
import { StateService } from './services/state/state-service';

export abstract class Game<
  PARAMETERS extends GameParameters | undefined = undefined,
>
  implements QueryableRuntime, FlushableRuntime, ModifiableRuntime
{
  private _logger: Logger;
  private _started: boolean = false;

  private readonly _entityService: EntityService;
  private readonly _choiceService: ChoiceService;
  private readonly _stateService: StateService;

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

    this._entityService = new EntityService(
      this._logger,
      this.flush.bind(this),
    );
    this._choiceService = new ChoiceService(
      {
        positiveRules: this.positiveRules(),
        negativeRules: this.negativeRules() ?? new Set(),
      },
      this._logger,
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
   * The name of the game.
   */
  public abstract readonly name: string;

  /**
   * Returns the set of all positive rules that should be applied in this game.
   * Needs to be implemented by the game itself.
   */
  // TODO: Should this be a method or readonly property (ReadonlySet)?
  abstract positiveRules(): Set<PositiveRule>;

  /**
   * Returns the set of all negative rules that should be applied in this game.
   * Needs to be implemented by the game itself.
   */
  // TODO: Should this be a method or readonly property (ReadonlySet)?
  abstract negativeRules(): Set<NegativeRule> | void;

  /**
   * Returns the set of all triggers that are registered in this game.
   */
  abstract triggers(): Set<Trigger> | void;

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
    if (this.positiveRules().size === 0) {
      throw new Error(
        `No positive rules provided. A game without positive rules is not possible! Please register some.`,
      );
    }
    this._logger.info(
      () => `Registered ${this.positiveRules().size} positive rules.`,
    );

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

  /**
   * Starts the actual game loop.
   */
  private _nextSnapshot(): void {
    this._started = true;
    this._logger.info(() => `Calculating next snapshot...`);

    // Clean up prior snapshot data.
    this._stateService.clear();

    // Work off stack first...
    const target = this._stateService.workOffStack(this);

    if (target !== undefined) {
      this._logger.debug(
        () => `Finished working off stack item, moving to next snapshot...`,
      );
      this._nextSnapshot();
      return;
    }

    // Check for triggers, that go off from this game state.
    const triggers: TriggerReturnType[] = [];
    for (const trigger of this.triggers() ?? []) {
      const triggered = trigger.apply(this, undefined); // TODO: Reference last trigger here correctly!

      if (triggered !== undefined) {
        triggers.push(...triggered);
      }
    }

    if (triggers.length > 0) {
      this._logger.info(
        () => `Triggers went off! Executing ${triggers.length} triggers...`,
      );

      this._stateService.pushToStack(...triggers);
      this._nextSnapshot();
      return;
    }

    // Find all choices for players in the current state.
    const choices = this._choiceService.calculateChoices(this);

    // Split choices by player and inform them.
    for (const choice of choices) {
      this._stateService.registerChoice(choice.player, choice);
    }

    // FIXME: Implement correctly.
    for (const player of this._entityService.players()) {
      this._stateService.informPlayer(player);
    }

    // Drain queued executed choices.
    const choice = this._stateService.getQueuedChoice();
    if (choice !== undefined) {
      this._stateService.executePlayerChoice(choice.player, choice, this);
      this._nextSnapshot();
    }
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
      if (!this._started) {
        this._start();
      } else {
        this._logger.info(
          () =>
            `Player interface with ID ${player[playerId]} reconnected. Informing them about their state...`,
        );

        this._stateService.informPlayer(player, true);
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
}

// TODO: Win / Lose game functionality!
