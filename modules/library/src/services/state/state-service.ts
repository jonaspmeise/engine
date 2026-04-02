import { Action } from '../../components/action';
import { Choice, EnhancedChoice } from '../../components/choice';
import { ChoiceId } from '../../components/choice.types';
import { Entity, entityId } from '../../components/entity';
import { TriggerReturnType } from '../../components/trigger';
import { DeepReadonly, Logger, SnapshotData } from '../../game.types';
import { ModifiableRuntime } from '../../interfaces/modifiable-runtime';
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
    choices: new Map<PlayerInterface, EnhancedChoice<Action<any>>[]>(),
    queuedChoices: [] as EnhancedChoice<Action<any>>[],
    stack: [] as TriggerReturnType[],
    isSettled: true,
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

  /**
   * Works off the top of the stack.
   * The stack contains all executions (e.g. choices or triggers) that piled up due to triggers.
   * @param runtime A reference to the runtime.
   * @returns The item worked off if it exists, otherwise undefined.
   */
  public workOffStack(
    runtime: ModifiableRuntime,
  ): TriggerReturnType | undefined {
    if (this._state.stack.length == 0) {
      this._logger.debug(() => `Stack is empty.`);
      return undefined;
    }

    const target = this._state.stack.pop()!;
    const isChoice = target instanceof Choice;
    this._logger.debug(
      () => `Executing ${isChoice ? 'choice' : 'execution'} from stack...`,
    );

    // Only add the snapshot if the prior snapshot actually changed something...
    if (
      Object.keys(
        this._state.currentSnapshots[this._state.currentSnapshots.length - 1]!
          .dirtyEntities,
      ).length > 0
    ) {
      this._logger.debug(
        () =>
          `Adding snapshot for this ${isChoice ? 'choice' : 'execution'} to state...`,
      );
      this._state.currentSnapshots.push({
        dirtyEntities: {},
        executed: isChoice ? target : undefined,
      });
    }

    if (isChoice) {
      target.execution.apply(runtime);
    } else {
      target(runtime); // TODO: Reference last trigger here correctly!
    }

    this._logger.debug(
      () =>
        `Finished executing ${isChoice ? 'choice' : 'execution'} from stack, ${this._state.stack.length} stack items remaining.`,
    );

    return target;
  }

  public lastExecution(): Choice<Action<any>> | undefined {
    return this._state.currentSnapshots[
      this._state.currentSnapshots.length - 1
    ]!.executed;
  }

  /**
   * Pushes a single item to the stack, which is worked off in the next snapshot.
   * @param items The items to add.
   */
  public pushToStack(...items: TriggerReturnType[]): void {
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
    choice: EnhancedChoice<Action<any>>,
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
  public getQueuedChoice(): EnhancedChoice<Action<any>> | undefined {
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

  /**
   * Informs a player about their current state.
   * @param player The player to inform about their state.
   * @param executeChoiceCallback A callback that can be called to execute a choice within the engine.
   * @param sendFullState Whether to send the full state to the player, or only a diff.
   * For example, if a player disconnected and reconnected, they should be informed about their full state.
   * Normally, only the diff is sent.
   */
  public informPlayer(
    player: PlayerEntity,
    executeChoiceCallback: (
      player: PlayerEntity,
      choice: EnhancedChoice<Action<any>>,
    ) => void,
    sendFullState: boolean = false,
  ): void {
    this._logger.debug(
      () =>
        `Informing player ${player[playerId]} about their state. Sending full state? ${sendFullState}.`,
    );

    player[handler]!(
      this._state.currentSnapshots,
      this._state.choices.get(player) ?? [],
      (rawChoice: EnhancedChoice<Action<any>> | ChoiceId) => {
        const choice = this._fetchChoice(player, rawChoice);

        if (choice === undefined) {
          return;
        }

        this._logger.info(
          () =>
            `Player ${player[playerId]} tries to execute choice "${choice.id}" (${choice.execution.$type})...`,
        );

        if (this._state.isSettled) {
          executeChoiceCallback(player, choice);
        } else {
          // Debounce this execution, so that if multiple players are informed or want to execute a choice,
          // they have a fair chance to do so before first player in the loop simply takes all their actions and forces new snapshots.
          this._state.queuedChoices.push(choice);
        }
      },
    );
  }

  /**
   * Executes a given choice.
   * @player The player that executed the choice.
   * @param choice The choice to execute.
   * @param runtime The runtime to execute the choice in.
   */
  public executePlayerChoice(
    player: PlayerEntity,
    choice: EnhancedChoice<Action<any>>,
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
}
