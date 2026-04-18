import { Action } from '../../components/action';
import { EnhancedChoice } from '../../components/choice';
import { ChoiceId } from '../../components/choice.types';
import { Entity, entityId } from '../../components/entity';
import {
  SnapshotData,
  Logger,
  GameStatus,
  GameEndParameters,
  Snapshot,
} from '../../game/game.types';
import { ModifiableRuntime } from '../../game/modifiable-runtime';
import {
  PlayerInterface,
  handler,
  playerId,
} from '../../interfaces/player-interface';
import {
  EntityFlushCallbackType,
  PlayerEntity,
} from '../entity/entity-service.types';

// TODO: Clean up, write tests.
/**
 * Models and encapsulates all information relevant to the state of the game.
 */
export class StateService {
  private _state: SnapshotData = {
    currentSnapshots: [
      {
        dirtyEntities: {},
        executed: undefined,
      },
    ],
    pastSnapshots: [],
    stack: [] as EnhancedChoice<Action<string, any, any>>[],
    choices: new Map<PlayerInterface, EnhancedChoice<Action<string, any>>[]>(),
    queuedChoices: [] as EnhancedChoice<Action<string, any>>[],
    isSettled: true,
    idCounter: 0,
  };

  private _status: GameStatus = 'setup';
  private _endParameters: GameEndParameters | undefined = undefined;

  constructor(private readonly _logger: Logger) {}

  public markDirty(entity: Entity, type: EntityFlushCallbackType): void {
    this._logger.debug(
      `Marking entity ${entity.constructor.name} with ID ${entity[entityId]} as dirty.`,
    );

    this._state.currentSnapshots[
      this._state.currentSnapshots.length - 1
      // TODO: "as" needed here?
    ]!.dirtyEntities[entity[entityId]] = type === 'deleted' ? null : entity;
  }

  public status(): GameStatus {
    return this._status;
  }

  public setStatus(status: GameStatus): void {
    this._status = status;
  }

  public endStatus(): GameEndParameters | undefined {
    return this._endParameters;
  }

  public setEndParameters(params: GameEndParameters | undefined): void {
    this._endParameters = params;
  }

  /**
   * Creates a clone of this StateService, copying the game lifecycle state and snapshot depth.
   * Transient runtime state (pending choices, stack) is not carried over.
   * @returns A new StateService with the same status, end parameters, and snapshot history.
   */
  public clone(logger?: Logger): StateService {
    const cloned = new StateService(logger ?? this._logger);
    // Reset to 'setup' so that when player callbacks are registered on the clone,
    // _start() is always invoked and the game loop runs from the current board state.
    cloned._status = 'setup';
    cloned._endParameters = this._endParameters;
    cloned._state.idCounter = this._state.idCounter;
    cloned._state.pastSnapshots = [...this._state.pastSnapshots];
    cloned._state.currentSnapshots = [...this._state.currentSnapshots];
    return cloned;
  }

  public clear(): void {
    this._state.choices.clear();
    this._state.queuedChoices.length = 0;
  }

  /**
   * Returns the last executed action, if it exists.
   * @returns the last executed action, if it exists, otherwise undefined.
   */
  public lastExecution(): Action<string, any> | undefined {
    return this._state.currentSnapshots[
      this._state.currentSnapshots.length - 1
    ]!.executed;
  }

  /**
   * Pushes a single item to the stack, which is worked off in the next snapshot.
   * @param items The items to add.
   */
  public pushToStack(
    ...items: EnhancedChoice<Action<string, any, any>>[]
  ): void {
    this._logger.debug(
      `Pushing ${items.length} item${items.length !== 1 ? 's' : ''} to stack...`,
    );

    for (const item of items) {
      this._logger.debug(
        () =>
          `Pushing ${item instanceof EnhancedChoice ? `choice (${item.execution.$type})` : 'execution'} to stack...`,
      );

      this._state.stack.push(item);
    }
  }

  public registerChoice(
    player: PlayerInterface,
    choice: EnhancedChoice<Action<string, any>>,
  ): void {
    this._logger.debug(
      `Registering choice ${choice.execution.$type} for player ${player[playerId]}...`,
    );

    if (!this._state.choices.has(choice.player)) {
      this._state.choices.set(choice.player, []);
    }
    this._state.choices.get(choice.player)!.push(choice);
  }

  /**
   * Returns the first queued choice, if its exists.
   * If multiple choices exist, only the first one will be returned.
   * @returns The first queued choice, if it exists, otherwise undefined.
   */
  public getQueuedChoice(): EnhancedChoice<Action<string, any>> | undefined {
    if (this._state.queuedChoices.length > 1) {
      this._logger.error(
        `Multiple choices were executed in the same snapshot (${this._state.queuedChoices.length}). This can lead to unexpected behavior, since the game state is not updated between these executions. Consider debouncing choice executions on the client or server side to prevent this.`,
      );
    }

    return this._state.queuedChoices[0];
  }

  /**
   * Returns the total depth of the replays.
   * @returns The total depth of the replays.
   */
  public depth(): Readonly<number> {
    return this._state.pastSnapshots.length;
  }

  public setSettled(isSettled: boolean): void {
    this._logger.debug(`Setting state to settled: ${isSettled}...`);
    this._state.isSettled = isSettled;
  }

  /**
   * Prompts a player with a list of choices and waits for their responses.
   * @param player The player to prompt.
   * @param choices The choices that are available to the player.
   * @returns a Promise that resolves to the action of the picked choice.
   */
  public async promptPlayer<ACTION extends Action<string, any, any>>(
    player: PlayerEntity,
    choices: ACTION[],
  ): Promise<ACTION> {
    this._logger.debug(
      `Prompting player interface with ID ${player[playerId]} with choices: ${choices
        .map((c) => c.$type)
        .join(', ')}...`,
    );

    if (choices.length === 0) {
      throw new Error(`No choices provided for player ${player[playerId]}!`);
    }

    // Clear prior choices.
    const priorChoices: EnhancedChoice<ACTION>[] = [];
    this._state.choices.set(player, priorChoices);

    // TODO: Enhance choices with ID and save the choices somewhere!
    choices.forEach((choice) => {
      priorChoices.push(
        EnhancedChoice.fromAction(choice, player, this._state.idCounter++),
      );
    });

    return new Promise((resolve) => {
      player[handler]!.prompt(
        priorChoices,
        (choice: EnhancedChoice<Action<string, any>> | ChoiceId) => {
          const id = typeof choice === 'object' ? choice.id : choice;
          const fetchedChoice = priorChoices.find((c) => c.id === id);

          if (fetchedChoice === undefined) {
            this._logger.error(
              `Player ${player[playerId]} tried to execute an invalid choice with ID ${choice}. Ignoring this...`,
            );
            return;
          }

          this._logger.info(
            `Player ${player[playerId]} tries to execute choice "${fetchedChoice.id}" (${fetchedChoice.execution.$type})...`,
          );

          this._logger.debug(
            `Returning ${fetchedChoice.execution.$type} (class: ${fetchedChoice.execution.constructor.name}) as result of prompt...`,
          );

          resolve(fetchedChoice.execution);
        },
      );
    });
  }

  /**
   * Sends the current, modified state to a player.
   * @param player The player to inform about their state.
   * @param sendFullState Whether to send the full state to the player, or only a diff.
   * For example, if a player disconnected and reconnected, they should be informed about their full state.
   * Normally, only the diff is sent.
   */
  public informPlayer(
    player: PlayerEntity,
    sendFullState: boolean = false, // TODO: Implement!
  ): void {
    this._logger.debug(
      `Informing player ${player[playerId]} about their state. Sending full state? ${sendFullState}.`,
    );

    // We translate the internal snapshot data into a player-facing format and apply visibility...
    const snapshots: Snapshot[] = this._state.currentSnapshots.map(
      (snapshot) => ({
        dirtyEntities: Object.fromEntries(
          Object.entries(snapshot.dirtyEntities).map(([id, entity]) => [
            id,
            entity == null ? null : entity.visibility(player),
          ]),
        ),
        executed: snapshot.executed,
      }),
    );

    player[handler]!.state(snapshots);
  }

  /**
   * Executes an action and thus modifies the game state.
   * @param action The action to execute.
   * @param runtime The runtime to execute the action in.
   * @returns The executed action. This may not be the same object as the passed in action,
   * since some properties (or even its complete type!) may be modified during execution due to triggers.
   */
  public execute(
    action: Action<string, any, any>,
    runtime: ModifiableRuntime, // TODO: Modifiable vs. Queryable?
  ): Action<string, any, any> {
    this._logger.info(`Executing action "${action.$type}"...`);

    // Clear prior snapshot state and calculate the next one.
    this._state.pastSnapshots.push(...this._state.currentSnapshots);
    this._state.currentSnapshots = [
      {
        dirtyEntities: {},
        executed: action,
      },
    ];
    action.apply(runtime);

    return action;
  }
}
