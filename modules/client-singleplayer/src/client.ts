/// <reference lib="dom" />

import {
  Clearable,
  DEFAULT_GAME_CONFIG,
  EntityClassMapping,
  Game,
  PlayerInterface,
  type Action,
  type ChoiceId,
  type EnhancedChoice,
  type Logger,
  type QueryableRuntime,
  type Snapshot,
} from '@my-engine/library';
import { ActionRenderFunction, ClientState } from './client.types';
import { ClientEntityHandler } from './client-entity-handler';
import { DebugService } from './debug-service';
/**
 * Models a HTML5-based client for a game.
 * This client is responsible for rendering the game state, allowing the user to interact with the game
 * through the DOM and updating its internal state.
 */
// TODO: Rename to something like "HTMLClient" or "BrowserClient" to distinguish from potential future clients.
export abstract class Client<
  TARGET_ELEMENT extends HTMLElement = HTMLElement,
  ACTIONS extends Action<string, any, any> = Action<string, any, any>,
> implements Clearable {
  // TODO: How to represent game state in the client? We only need Entities and Choices...
  private _state: ClientState;

  protected readonly _logger: Logger = DEFAULT_GAME_CONFIG.logger;
  private readonly _entityClassMapping: EntityClassMapping;
  private readonly _debug: DebugService;
  private _choices: EnhancedChoice<Action<string, any, any>>[] = [];
  public static readonly GAME_RESET_EVENT = 'game:reset';

  /**
   * Initializes a HTML5-based client for a game.
   * @param renderTarget The target element into which the game should be rendered.
   * @param game The reference to the base game. The game is not instantiated, just used to access setup methods.
   * @param player The player interface that this client represents.
   * @param logger A custom logger that can be provided.
   * @param debug When true, a toggleable debug panel showing snapshot data is rendered in the top-right corner.
   */
  constructor(
    private readonly renderTarget: TARGET_ELEMENT,
    game: Game<any>,
    protected readonly player: PlayerInterface,
    logger?: Partial<Logger>,
  ) {
    Object.assign(this._logger, logger);

    this._entityClassMapping = game.entityClassMapping();
    this._state = {
      snapshots: [],
      entityHandler: new ClientEntityHandler(
        this._entityClassMapping,
        this._logger,
      ),
    };

    this._debug = new DebugService(() => this._state.entityHandler.entities());

    // Register this object in global window scope.
    (window as any).client = this;
  }

  /**
   * Resets the client to its initial state, clearing all internal state and the render target.
   * Fires a 'game:reset' event on the render target so external code can reinitialise the game.
   */
  public clear(): void {
    this._state = {
      snapshots: [],
      entityHandler: new ClientEntityHandler(
        this._entityClassMapping,
        this._logger,
      ),
    };
    this._debug.clear();
    this.renderTarget.replaceChildren();
    this.renderTarget.dispatchEvent(
      new CustomEvent(Client.GAME_RESET_EVENT, { bubbles: true }),
    );
  }

  public async feedChoices(
    choices: EnhancedChoice<Action<string, any, any>>[],
    executeCallback: (
      choice: EnhancedChoice<Action<string, any, any>> | ChoiceId,
    ) => void,
  ): Promise<void> {
    // Erase prior highlights!
    await this.eraseHighlights();

    this._logger.debug(
      `Client is fed with ${choices.length} choices...`,
      choices,
    );

    this._choices = choices;

    for (const choice of choices) {
      this._logger.debug(`Highlighting choice ${choice.id}...`, choice);
      this.choiceTypeMapping[choice.execution.$type as ACTIONS['$type']].render(
        choice.execution as Extract<ACTIONS, { $type: ACTIONS['$type'] }>,
        () => {
          this._logger.debug(`Player executes choice ${choice.id}...`, choice);

          executeCallback(choice);
          // Erase prior highlights!
          this.eraseHighlights();
        },
      );
    }
  }

  /**
   * Describes the mapping between all possible choices and their corresponding ways to render them.
   * This should be populated with all known action types.
   * Each action is mapped to an unique rendering function.
   */
  public abstract choiceTypeMapping: {
    [K in ACTIONS['$type']]: ActionRenderFunction<
      Extract<ACTIONS, { $type: K }>
    >;
  };

  /**
   * Applies the updates from a callback to this client.
   * @param callback The callback, that is issued by the engine / server or the communication layer.
   */
  // TODO: This are redundant types to PlayerInterfaceCallback, so either abstract it here or simply pass a single object...
  /**
   * Convenience method that feeds both snapshots and choices in one call.
   * Subclasses may override this to intercept the full set of choices before
   * they are dispatched to {@link feedChoices} (e.g. to show a modal for special actions).
   */
  public async feed(
    snapshots: Snapshot[],
    choices: EnhancedChoice<Action<string, any, any>>[],
    execute: (
      choice: EnhancedChoice<Action<string, any, any>> | ChoiceId,
    ) => void,
  ): Promise<void> {
    await this.feedSnapshots(snapshots);
    await this.feedChoices(choices, execute);
  }

  public async feedSnapshots(snapshots: Snapshot[]): Promise<void> {
    this._logger.debug('Client is fed with snapshots...', snapshots);

    for (const snapshot of snapshots) {
      this._state.snapshots.push(snapshot);

      // Record debug history eagerly before the entity handler applies the delta.
      this._debug.recordSnapshot(snapshot);

      // Feed the snapshot into our entity service!
      for (const [id, entityDelta] of Object.entries(snapshot.dirtyEntities)) {
        this._logger.debug(`Applying delta for entity ${id}...`, entityDelta);
        this._state.entityHandler.apply(id, entityDelta);
      }

      if (snapshot.executed !== undefined) {
        this._logger.debug(
          `Animating executed choice (before)...`,
          snapshot.executed,
        );
        await this.animateBefore(snapshot.executed);
      }

      this.render(this.renderTarget, this._state.entityHandler);

      if (snapshot.executed !== undefined) {
        this._logger.debug(
          `Animating executed choice (after)...`,
          snapshot.executed,
        );
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        await this.animateAfter(snapshot.executed);
      }
    }
  }

  /**
   * This is called when a new snapshot is fed into the client, and the prior prompted choices are no longer valid.
   */
  protected async eraseHighlights(): Promise<void> {
    // We access the inverse operation of highlighting the choice type here.
    this._logger.debug(`Erasing highlights for all choices...`);

    for (const prior of this._choices) {
      this._logger.debug(`Erasing choice ${prior.id}...`, prior);
      await this.choiceTypeMapping[
        prior.execution.$type as ACTIONS['$type']
      ].erase(prior.execution as Extract<ACTIONS, { $type: ACTIONS['$type'] }>);
    }
  }

  /**
   * Animates the game state before the UI is rendered.
   * This is called before rendering the game state.
   * @returns A promise that resolves when the animation is complete.
   */
  protected abstract animateBefore(choice: Action<string, any>): Promise<void>;

  /**
   * Animates the game state after the UI is rendered.
   * This is called after rendering the game state.
   * @returns A promise that resolves when the animation is complete.
   */
  protected abstract animateAfter(choice: Action<string, any>): Promise<void>;

  /**
   * Renders the game state into the target element.
   * You should make sure that
   * @param renderTarget The element into which the game state should be rendered.
   * @param clientHandler A helper object that allows you to easily access entities.
   * The entities are always of the current snapshot, no past snapshots or historic data.
   */
  protected abstract render(
    renderTarget: TARGET_ELEMENT,
    runtime: QueryableRuntime,
  ): void;

  /**
   * Returns a representation for the saved state as collected by the client.
   * This is only necessary for debugging.
   */
  public state(): ClientEntityHandler {
    return this._state.entityHandler;
  }
}
