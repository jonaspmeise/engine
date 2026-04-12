import { Action } from '../../components/action';
import { Choice, EnhancedChoice } from '../../components/choice';
import { ChoiceId } from '../../components/choice.types';
import { Entity, entityId } from '../../components/entity';
import { SnapshotData, Logger, DeepReadonly } from '../../game/game.types';
import { ModifiableRuntime } from '../../game/modifiable-runtime';
import {
  PlayerInterface,
  handler,
  playerId,
} from '../../interfaces/player-interface';
import { PlayerEntity } from '../entity/entity-service.types';

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
    stack: [] as Choice<Action<string, any, any>>[],
    choices: new Map<PlayerInterface, EnhancedChoice<Action<string, any>>[]>(),
    queuedChoices: [] as EnhancedChoice<Action<string, any>>[],
    isSettled: true,
    idCounter: 0,
  };

  constructor(private readonly _logger: Logger) {}

  public markDirty(entity: Entity): void {
    this._logger.debug(
      () =>
        `Marking entity ${entity.constructor.name} with ID ${entity[entityId]} as dirty.`,
    );

    this._state.currentSnapshots[
      this._state.currentSnapshots.length - 1
      // TODO: "as" needed here?
    ]!.dirtyEntities[entity[entityId]] = entity as DeepReadonly<typeof entity>;
  }

  public clear(): void {
    this._state.choices.clear();
    this._state.queuedChoices.length = 0;
  }

  public lastExecution(): Choice<Action<string, any>> | undefined {
    return this._state.currentSnapshots[
      this._state.currentSnapshots.length - 1
    ]!.executed;
  }

  /**
   * Pushes a single item to the stack, which is worked off in the next snapshot.
   * @param items The items to add.
   */
  public pushToStack(...items: Choice<Action<string, any, any>>[]): void {
    this._logger.debug(
      () =>
        `Pushing ${items.length} item${items.length !== 1 ? 's' : ''} to stack...`,
    );

    for (const item of items) {
      this._logger.debug(
        () =>
          `Pushing ${item instanceof Choice ? `choice (${item.execution.$type})` : 'execution'} to stack...`,
      );

      this._state.stack.push(item);
    }
  }

  public registerChoice(
    player: PlayerInterface,
    choice: EnhancedChoice<Action<string, any>>,
  ): void {
    this._logger.debug(
      () =>
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
    this._logger.debug(() => `Setting state to settled: ${isSettled}...`);
    this._state.isSettled = isSettled;
  }

  public async promptPlayer<T extends Choice<Action<string, any, any>>>(
    player: PlayerEntity,
    choices: T[],
  ): Promise<T extends Choice<infer A> ? A : never> {
    this._logger.debug(
      () =>
        `Prompting player interface with ID ${player[playerId]} with choices: ${choices
          .map((c) => c.execution.$type)
          .join(', ')}...`,
    );
    // Clear prior choices.
    const priorChoices: EnhancedChoice<Action<string, any>>[] = [];
    this._state.choices.set(player, priorChoices);

    // TODO: Enhance choices with ID and save the choices somewhere!
    choices.forEach((choice) => {
      priorChoices.push(
        EnhancedChoice.fromChoice(choice, this._state.idCounter++),
      );
    });

    return new Promise((resolve) => {
      player[handler]!.prompt(
        priorChoices,
        (choice: EnhancedChoice<Action<string, any, any>> | ChoiceId) => {
          const fetchedChoice = this._fetchChoice(player, choice);
          if (fetchedChoice === undefined) {
            this._logger.error(
              `Player ${player[playerId]} tried to execute an invalid choice with ID ${choice}. Ignoring this...`,
            );
            return;
          }

          this._logger.info(
            () =>
              `Player ${player[playerId]} tries to execute choice "${fetchedChoice.id}" (${fetchedChoice.execution.$type})...`,
          );

          resolve(fetchedChoice.execution.returned());
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
    sendFullState: boolean = false,
  ): void {
    this._logger.debug(
      () =>
        `Informing player ${player[playerId]} about their state. Sending full state? ${sendFullState}.`,
    );

    const rawSnapshots = this._state.currentSnapshots;

    player[handler]!.state(rawSnapshots);
  }

  /**
   * Executes a given choice.
   * @player The player that executed the choice.
   * @param choice The choice to execute.
   * @param runtime The runtime to execute the choice in.
   */
  public executePlayerChoice(
    player: PlayerEntity,
    choice: EnhancedChoice<Action<string, any>>,
    runtime: ModifiableRuntime, // TODO: Modifiable vs. Queryable?
  ): void {
    this._logger.info(
      () =>
        `Player ${player[playerId]} executes choice "${choice.id}" (${choice.execution.$type}).`,
    );

    // Clear prior snapshot state and calculate the next one.
    this._state.pastSnapshots.push(...this._state.currentSnapshots);
    this._state.currentSnapshots = [
      {
        dirtyEntities: {},
        executed: choice,
      },
    ];
    choice.execution.apply(runtime);
  }

  private _fetchChoice(
    player: PlayerEntity,
    rawChoice: EnhancedChoice<Action<string, any>> | ChoiceId,
  ): EnhancedChoice<Action<string, any>> | undefined {
    const choice: EnhancedChoice<Action<string, any>> | undefined =
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
}
