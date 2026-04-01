/// <reference lib="dom" />

import {
  DEFAULT_GAME_CONFIG,
  Entity,
  EntityService,
  type Action,
  type ChoiceId,
  type EnhancedChoice,
  type Logger,
  type QueryableRuntime,
  type Snapshot,
} from '@my-engine/library';
import { ClientState } from './client.types';
/**
 * Models a HTML5-based client for a game.
 * This client is responsible for rendering the game state, allowing the user to interact with the game
 * through the DOM and updating its internal state.
 */
// TODO: Rename to something like "HTMLClient" or "BrowserClient" to distinguish from potential future clients.
export abstract class Client<TARGET_ELEMENT extends HTMLElement = HTMLElement> {
  // TODO: How to represent game state in the client? We only need Entities and Choices...
  private readonly _state: ClientState;
  protected readonly _logger: Logger = DEFAULT_GAME_CONFIG.logger;

  constructor(
    private readonly renderTarget: TARGET_ELEMENT,
    logger?: Partial<Logger>,
  ) {
    Object.assign(this._logger, logger);

    this._state = {
      snapshots: [],
      entityService: new EntityService(this._logger, () => {}),
    };
  }

  /**
   * Applies the updates from a callback to this client.
   * @param callback The callback, that is issued by the engine / server or the communication layer.
   */
  // TODO: This are redundant types to PlayerInterfaceCallback, so either abstract it here or simply pass a single object...
  public async feed(
    snapshots: Snapshot[],
    choices: EnhancedChoice<Action<any>>[],
    execute: (choice: EnhancedChoice<Action<any>> | ChoiceId) => void,
  ): Promise<void> {
    this._logger.debug('Client is fed with data...', snapshots, choices);

    for (const snapshot of snapshots) {
      this._state.snapshots.push(snapshot);

      this.render(this.renderTarget, {} as QueryableRuntime);
      await this.animate(snapshots[snapshots.length - 1]!);
    }
  }

  /**
   * Animates the game state.
   * This is called after rendering the game state.
   * @returns A promise that resolves when the animation is complete.
   */
  protected abstract animate(snapshot: Snapshot): Promise<void>;

  /**
   * Renders the game state into the target element.
   * You should make sure that
   * @param renderTarget The element into which the game state should be rendered.
   * @param runtime A helper object that allows you to easily access entities.
   * The entities are always of the current snapshot, no past snapshots or historic data.
   */
  protected abstract render(
    renderTarget: TARGET_ELEMENT,
    runtime: QueryableRuntime,
  ): void;
}
