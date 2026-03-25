import { Action } from './components/action';
import { Entity } from './components/entity';
import { FlushableRuntime } from './interfaces/flushable-runtime';
import {
  Class,
  DeepReadonly,
  DEFAULT_GAME_CONFIG,
  GameConfig,
  GameParameters,
  Logger,
  PlayerInterfaceCallback,
  SnapshotData,
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
import { SnapshotService } from './services/snapshot/snapshot-service';
import { EnhancedChoice } from './components/choice';
import { ChoiceId } from './components/choice.types';
import { PlayerEntity } from './services/entity/entity-service.types';
import { ModifiableRuntime } from './interfaces/modifiable-runtime';

export abstract class Game<
  PARAMETERS extends GameParameters | undefined = undefined,
>
  implements QueryableRuntime, FlushableRuntime, ModifiableRuntime
{
  private _logger: Logger;
  private _started: boolean = false;

  private readonly _entityService: EntityService;
  private readonly _snapshotService: SnapshotService;

  // TODO: Move to own service? PlayerHandlerService? Does this state just live here now...?
  private _state: SnapshotData = {
    choices: new Map(),
    dirtyEntities: new Set(),
    executedChoices: [] as EnhancedChoice<Action<any>>[],
  };

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
    this._snapshotService = new SnapshotService(
      {
        positiveRules: this.positiveRules(),
        negativeRules: this.negativeRules() ?? new Set(),
      },
      this._logger,
    );

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
   * Returns the set of all positive rules that are applied in this game.
   * Needs to be implemented by the game itself.
   */
  // TODO: Should this return instances or classes of actions?
  // TODO: Should this be a method or readonly property (ReadonlySet)?
  abstract positiveRules(): Set<PositiveRule>;

  /**
   * Returns the set of all negative rules that are applied in this game.
   * Needs to be implemented by the game itself.
   */
  // TODO: Should this return instances or classes of actions?
  // TODO: Should this be a method or readonly property (ReadonlySet)?
  abstract negativeRules(): Set<NegativeRule> | void;

  /**
   * Flushes the current state of an entity to the engine.
   * This should be called, when that entity is changed or a new entity is spawned.
   * @param entity The entity to flush.
   */
  public flush(entity: Entity): void {
    this._logger.debug(
      () =>
        `Flushing entity ${entity.constructor.name} with ID ${entity.id} in game ${this.constructor.name}.`,
    );

    // TODO: "as" needed here?
    this._state.dirtyEntities.add(entity as DeepReadonly<typeof entity>);
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
    this._state.choices.clear();
    this._state.executedChoices.length = 0;

    // Find all choices for players in the current state.
    const choices = this._snapshotService.calculateChoices(this);

    // Split choices by player and inform them.
    for (const choice of choices) {
      if (!this._state.choices.has(choice.player)) {
        this._state.choices.set(choice.player, []);
      }
      this._state.choices.get(choice.player)!.push(choice);
    }

    for (const player of this._entityService.players()) {
      this._logger.debug(
        () =>
          `Player ${player.id} has ${this._state.choices.get(player)?.length ?? 0} choices.`,
      );
    }

    // FIXME: Implement correctly.
    for (const player of this._entityService.players()) {
      this._informPlayer(player);
    }

    // Drain buffered executed choices.
    if (this._state.executedChoices.length > 1) {
      this._logger.error(
        `Multiple choices were executed in the same snapshot (${this._state.executedChoices.length}). This can lead to unexpected behavior, since the game state is not updated between these executions. Consider debouncing choice executions on the client or server side to prevent this.`,
      );
    }

    const choice = this._state.executedChoices[0];
    if (choice !== undefined) {
      this._executeChoice(choice.player, choice);
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
    player: PlayerEntity,
    sendFullState: boolean = false,
  ): void {
    this._logger.debug(
      () =>
        `Informing player ${player[playerId]} about their state. Sending full state? ${sendFullState}.`,
    );

    player[handler]!(
      this._state.dirtyEntities,
      this._state.choices.get(player) ?? [],
      (rawChoice: EnhancedChoice<Action<any>> | ChoiceId) => {
        const choice = this._fetchChoice(player, rawChoice);

        if (choice === undefined) {
          return;
        }

        this._logger.info(
          () =>
            `Player ${player[playerId]} tries to execute choice "${choice.id}" (${choice.execution.type})...`,
        );

        // Debounce this execution, so that if multiple players are informed or want to execute a choice,
        // they have a fair chance to do so before first player in the loop simply takes all their actions and forces new snapshots.
        this._state.executedChoices.push(choice);
      },
    );
  }

  private _fetchChoice(
    player: PlayerEntity,
    rawChoice: EnhancedChoice<Action<any>> | ChoiceId,
  ): EnhancedChoice<Action<any>> | undefined {
    const choice: EnhancedChoice<Action<any>> | undefined =
      typeof rawChoice === 'object'
        ? rawChoice
        : this._state.choices.get(player)?.find((c) => c.id === rawChoice);

    if (choice === undefined) {
      this._logger.error(
        `Player ${player[playerId]} tried to execute an invalid choice with ID ${rawChoice}. Ignoring this...`,
      );
      return;
    }

    return choice;
  }

  /**
   * Executes a given choice.
   * @param choice The choice to execute.
   */
  private _executeChoice(
    player: PlayerEntity,
    choice: EnhancedChoice<Action<any>>,
  ): void {
    this._logger.info(
      () =>
        `Player ${player[playerId]} executes choice "${choice.id}" (${choice.execution.type}).`,
    );

    // Clear prior snapshot state and calculate the next one.
    this._state.dirtyEntities.clear();
    choice.execution.apply(this);

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

  // TODO: Maybe move these to another place...
  /**
   * Destroys an entity in the game.
   * @param entity The entity to destroy.
   */
  destroyEntity(entity: Entity): void {
    this._logger.info(
      () =>
        `Destroying entity ${entity.constructor.name} with ID ${entity.id} in game ${this.name}.`,
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
        `Spawning entity ${entity.constructor.name} with ID ${entity.id} in game ${this.name}.`,
    );

    this._entityService.create(entity);
  }
}
