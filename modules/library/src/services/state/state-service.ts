import { Action } from '../../components/action';
import { EnhancedChoice } from '../../components/choice';
import { ChoiceId } from '../../components/choice.types';
import { Entity, entityId } from '../../components/entity';
import {
  SnapshotData,
  InternalSnapshot,
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
    prompt: null,
    promptCallback: null,
    isSettled: true,
    idCounter: 0,
  };

  private _status: GameStatus = 'setup';
  private _endParameters: GameEndParameters | undefined = undefined;

  // The stack of actions currently being applied. A top-level action sits at the
  // bottom; an action whose `doApply` calls `runtime.execute(...)` pushes the
  // nested action on top while it runs. Each entry also carries the action's
  // own snapshot that accumulates its mutations. The snapshot is appended to
  // currentSnapshots only when the action's doApply completes, ensuring that
  // deeper-nested actions' snapshots always precede their ancestor's snapshot.
  private _executionStack: Array<{
    action?: Action<string, any, any>;
    ownSnapshot: InternalSnapshot;
  }> = [];

  // How many snapshots of the current batch have already been emitted to each
  // player. `informPlayer` sends only the snapshots appended since the player's
  // last inform, so a nested execute and its enclosing parent never emit the same
  // snapshot twice. Emitting incrementally (rather than deferring to when the
  // top-level action settles) is essential: when a nested action prompts the
  // player mid-execution, the snapshots accumulated so far must already have
  // reached the client so the player sees the up-to-date state they are deciding
  // on. Reset whenever a fresh top-level batch begins.
  private _emittedSnapshotCounts: Map<PlayerEntity, number> = new Map();

  constructor(private readonly _logger: Logger) {}

  public markDirty(entity: Entity, type: EntityFlushCallbackType): void {
    this._logger.debug(
      `Marking entity ${entity.constructor.name} with ID ${entity[entityId]} as dirty.`,
    );

    const entry = this._executionStack[this._executionStack.length - 1];
    if (entry === undefined) {
      // No action is executing (setup phase). Write directly to the initial
      // snapshot that is always present in currentSnapshots.
      this._state.currentSnapshots[
        this._state.currentSnapshots.length - 1
      ]!.dirtyEntities[entity[entityId]] = type === 'deleted' ? null : entity;
      return;
    }

    // Write to the current action's own snapshot. This snapshot will be
    // appended to currentSnapshots only when the action's doApply completes,
    // so deeper-nested actions' snapshots always land before the parent's.
    entry.ownSnapshot.dirtyEntities[entity[entityId]] =
      type === 'deleted' ? null : entity;
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

    const priorChoices: EnhancedChoice<ACTION>[] = choices.map((choice) =>
      EnhancedChoice.fromAction(choice, player, this._state.idCounter++),
    );
    this._state.choices.set(player, priorChoices);

    this._state.prompt = new Promise((resolve) => {
      this._state.promptCallback = (
        choice: EnhancedChoice<Action<string, any>> | ChoiceId,
      ) => {
        const id = typeof choice === 'object' ? choice.id : choice;
        // A stale callback (fired after the prompt already resolved) leaves no
        // registered choices for the player; treat that like any other invalid
        // choice rather than throwing on `.get(player)!`.
        const fetchedChoice = this._state.choices
          .get(player)
          ?.find((c) => c.id === id);

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
      };

      player[handler]!.prompt(priorChoices, this._state.promptCallback);
    });

    return this._state.prompt! as Promise<ACTION>;
  }

  /**
   * Send all prompts that are currently registered for a player again.
   * Should be called when a client reconnects after a disconnect.
   * This will resum the game loop where it was before.
   * @param player The player to inform.
   */
  public repromptPlayer(player: PlayerEntity): void {
    if (this._state.prompt === null || this._state.promptCallback === null) {
      return;
    }

    const choices = this._state.choices.get(player);
    if (choices === undefined || choices.length === 0) {
      return;
    }

    this._logger.debug(
      `Re-prompting player ${player[playerId]} with ${choices.length} choice(s)...`,
    );

    player[handler]!.prompt(choices, this._state.promptCallback);
  }

  /**
   * Applies player-specific visibility to a single entity entry from a snapshot.
   * Null (deleted) entries pass through unchanged.
   */
  private _applyVisibility(
    entity: Entity | null,
    player: PlayerEntity,
  ): ReturnType<Entity['visibility']> | null {
    return entity === null ? null : entity.visibility(player);
  }

  /**
   * Sends the current, modified state to a player.
   * @param player The player to inform about their state.
   * @param sendFullState Whether to send the full state to the player, or only a diff.
   * For example, if a player disconnected and reconnected, they should be informed about their full state.
   * Normally, only the diff is sent.
   * @param allEntities When sendFullState is true and this is provided, a single synthetic
   * snapshot is built from every live entity rather than replaying the current batch.
   * Pass entityService.entities() here on reconnect to guarantee every live entity
   * (including ones not touched in the current batch) reaches the client.
   */
  public informPlayer(
    player: PlayerEntity,
    sendFullState: boolean = false,
    allEntities?: readonly Entity[],
  ): void {
    this._logger.debug(
      `Informing player ${player[playerId]} about their state. Sending full state? ${sendFullState}.`,
    );

    if (player[handler] === undefined) {
      this._logger.error(
        `Player ${player[playerId]} does not have a handler registered to receive state updates. This likely means that the player disconnected and has not reconnected yet. Skipping informing this player...`,
      );
      return;
    }

    if (sendFullState && allEntities !== undefined) {
      // Synthesise a complete snapshot from every currently-live entity.
      // Visibility is applied identically to the incremental path below so
      // redaction logic is not duplicated.
      const fullSnapshot: Snapshot = {
        dirtyEntities: Object.fromEntries(
          allEntities.map((entity) => [
            entity[entityId],
            this._applyVisibility(entity, player),
          ]),
        ),
        executed: undefined,
      };
      // Mark the player as fully caught-up with the current batch so that
      // subsequent incremental calls only deliver snapshots added after this
      // reconnect — not the same batch a second time.
      this._emittedSnapshotCounts.set(
        player,
        this._state.currentSnapshots.length,
      );
      player[handler].state([fullSnapshot]);
      return;
    }

    // Send only the snapshots this player has not yet been informed about. A
    // full-state request without allEntities (e.g. the initial _start() call
    // where the full batch is already in currentSnapshots) always sends from
    // index 0. This keeps a nested `execute` and its enclosing parent from
    // emitting the same snapshots twice: the inner inform sends the freshly
    // appended ones; the outer inform then only sends what the parent appended
    // after the nested call.
    const alreadyEmitted = sendFullState
      ? 0
      : (this._emittedSnapshotCounts.get(player) ?? 0);
    const pending = this._state.currentSnapshots.slice(alreadyEmitted);

    const snapshots: Snapshot[] = pending.map((snapshot) => ({
      dirtyEntities: Object.fromEntries(
        Object.entries(snapshot.dirtyEntities).map(([id, entity]) => [
          id,
          this._applyVisibility(entity, player),
        ]),
      ),
      executed: snapshot.executed,
    }));

    this._emittedSnapshotCounts.set(
      player,
      this._state.currentSnapshots.length,
    );
    player[handler].state(snapshots);
  }

  /**
   * Runs a lifecycle-hook phase (before/check or after/after-any) whose direct
   * mutations would otherwise be lost. Direct mutations made by hooks of a
   * top-level action happen while the execution stack is empty: before-/check-
   * hook mutations land in the prior, already-emitted batch (which is then
   * archived), and after-hook mutations land in the action's already-emitted
   * snapshot whose emitted-count was already advanced. Neither is ever sent.
   *
   * Wrapping the phase pushes a dedicated snapshot frame so hook mutations
   * accumulate into their own snapshot, appended to the current batch in the
   * correct position (before the action for before-hooks, after it for
   * after-hooks). Nested `runtime.execute(...)` calls made inside the phase see
   * a non-empty stack and therefore join the current batch and emit themselves
   * as before.
   * @param callback The hook phase to run.
   * @returns true if the phase produced at least one direct mutation (a snapshot
   * was appended and should be emitted); false otherwise.
   */
  public async captureHookMutations(
    callback: () => Promise<void>,
  ): Promise<boolean> {
    const ownSnapshot: InternalSnapshot = { dirtyEntities: {} };
    this._executionStack.push({ ownSnapshot });

    try {
      await callback();
    } finally {
      this._executionStack.pop();
    }

    // Only append (and thus emit) when the phase actually mutated something, so
    // hook-free actions produce no extra, empty snapshots or client updates.
    if (Object.keys(ownSnapshot.dirtyEntities).length === 0) {
      return false;
    }

    this._state.currentSnapshots.push(ownSnapshot);
    return true;
  }

  /**
   * Executes an action and thus modifies the game state.
   * @param action The action to execute.
   * @param runtime The runtime to execute the action in.
   * @returns A promise that resolves to the executed action. This may not be the same object as the passed in action,
   * since some properties (or even its complete type!) may be modified during execution due to triggers.
   */
  public async execute(
    action: Action<string, any, any>,
    runtime: ModifiableRuntime, // TODO: Modifiable vs. Queryable?
  ): Promise<Action<string, any, any>> {
    this._logger.info(`Executing action "${action.$type}"...`);

    if (this._executionStack.length === 0) {
      // A new top-level action: archive the prior batch and begin a fresh one.
      this._state.pastSnapshots.push(...this._state.currentSnapshots);
      this._state.currentSnapshots = [];
      // The fresh batch has not been emitted to anyone yet.
      this._emittedSnapshotCounts.clear();
    }

    // Each action owns a snapshot that accumulates its mutations. It is appended
    // to currentSnapshots only after doApply returns, so every nested action's
    // snapshot appears before its ancestor's — clients see changes bottom-up.
    const ownSnapshot: InternalSnapshot = {
      dirtyEntities: {},
      executed: action,
    };
    this._executionStack.push({ action, ownSnapshot });

    try {
      await action.apply(runtime);
    } finally {
      this._state.currentSnapshots.push(ownSnapshot);
      this._executionStack.pop();
    }

    return action;
  }
}
