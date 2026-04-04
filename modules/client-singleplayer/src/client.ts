/// <reference lib="dom" />

import {
  Choice,
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
import { ClientState } from './client.types';
import { ClientEntityHandler } from './client-entity-handler';
/**
 * Models a HTML5-based client for a game.
 * This client is responsible for rendering the game state, allowing the user to interact with the game
 * through the DOM and updating its internal state.
 */
// TODO: Rename to something like "HTMLClient" or "BrowserClient" to distinguish from potential future clients.
export abstract class Client<
  TARGET_ELEMENT extends HTMLElement = HTMLElement,
> implements Clearable {
  private readonly CHOICE_CLASS = 'engine-choice';

  // TODO: How to represent game state in the client? We only need Entities and Choices...
  private _state: ClientState;
  private choiceExecuteCallback: (
    choice: EnhancedChoice<Action<string, any>> | ChoiceId,
  ) => void = () => {};

  protected readonly _logger: Logger = DEFAULT_GAME_CONFIG.logger;
  private readonly _entityClassMapping: EntityClassMapping;
  private _debugPanel: HTMLElement | null = null;

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
    debug: boolean = false,
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

    this._logger.debug('Injecting style element for choice highlighting...');
    const styleElement = this.highlightStyle();
    this.renderTarget.appendChild(styleElement);

    if (debug) {
      this._debugPanel = this._createDebugPanel();
      document.body.appendChild(this._debugPanel);
    }

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
    this.choiceExecuteCallback = () => {};
    this.renderTarget.replaceChildren();
    this.renderTarget.dispatchEvent(
      new CustomEvent('game:reset', { bubbles: true }),
    );
  }

  /**
   * Applies the updates from a callback to this client.
   * @param callback The callback, that is issued by the engine / server or the communication layer.
   */
  // TODO: This are redundant types to PlayerInterfaceCallback, so either abstract it here or simply pass a single object...
  public async feed(
    snapshots: Snapshot[],
    choices: EnhancedChoice<Action<string, any>>[],
    execute: (choice: EnhancedChoice<Action<string, any>> | ChoiceId) => void,
  ): Promise<void> {
    this._logger.debug('Client is fed with data...', snapshots, choices);

    this.choiceExecuteCallback = execute;
    // Erase prior highlights!
    this._highlightChoices(this.renderTarget, []);

    for (const snapshot of snapshots) {
      this._state.snapshots.push(snapshot);

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

    this._highlightChoices(this.renderTarget, choices);

    if (this._debugPanel) {
      this._updateDebugPanel(this._debugPanel, snapshots, choices);
    }
  }

  /**
   * Animates the game state before the UI is rendered.
   * This is called before rendering the game state.
   * @returns A promise that resolves when the animation is complete.
   */
  protected abstract animateBefore(
    choice: Choice<Action<string, any>>,
  ): Promise<void>;

  /**
   * Animates the game state after the UI is rendered.
   * This is called after rendering the game state.
   * @returns A promise that resolves when the animation is complete.
   */
  protected abstract animateAfter(
    choice: Choice<Action<string, any>>,
  ): Promise<void>;

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

  /**
   * Defines the style that should be applied to highlighted elements.
   * @returns A css style element that defines the style for highlighted elements.
   */
  protected abstract highlightStyle(): HTMLStyleElement;

  /**
   * Returns a representation for the saved state as collected by the client.
   * This is only necessary for debugging.
   */
  public state(): QueryableRuntime {
    return this._state.entityHandler;
  }

  /**
   * Highlights all elements of the render according to choices.
   * All elements that are a part of a choice are highlighted.
   * @param element The target render element.
   * @param choices The choices for which to highlight their related elements.
   */
  private _highlightChoices(
    element: TARGET_ELEMENT,
    choices: EnhancedChoice<Action<string, any>>[],
  ): void {
    this._logger.debug('Highlighting choices...', choices);

    // Clean all existing choices.
    (
      element.querySelectorAll(
        `.${this.CHOICE_CLASS}`,
      ) as NodeListOf<HTMLElement>
    ).forEach((el) => {
      el.classList.remove(this.CHOICE_CLASS);
      el.onclick = null;
    });

    // TODO: Find a mapping of entity IDs -> possible choices.
    for (const choice of choices) {
      const entityIDs =
        choice.execution.affectedEntities(this._state.entityHandler) ?? [];

      for (const entityId of entityIDs) {
        this._logger.debug(
          `Highlighting entity ${entityId} for choice ${choice.id}...`,
        );

        const entityElement = element.querySelector(
          `#${entityId}`,
        )! as HTMLElement;

        if (entityElement === null) {
          this._logger.error(
            `Could not find element for entity ${entityId} to highlight for choice ${choice.id}!`,
          );
          continue;
        }

        entityElement.classList.add(this.CHOICE_CLASS);
        entityElement.onclick = () => this._handleChoicesClick([choice]);
      }
    }
  }

  private _createDebugPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'engine-debug-panel';
    panel.style.cssText = [
      'position:fixed',
      'top:8px',
      'right:8px',
      'z-index:99999',
      'max-width:420px',
      'width:max-content',
      'font:12px/1.4 monospace',
      'background:rgba(15,15,20,0.92)',
      'color:#e8e8e8',
      'border:1px solid #444',
      'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.6)',
      'overflow:hidden',
    ].join(';');

    const toggle = document.createElement('button');
    toggle.textContent = '🐛 Debug';
    toggle.style.cssText = [
      'display:block',
      'width:100%',
      'padding:6px 10px',
      'background:transparent',
      'border:none',
      'border-bottom:1px solid #444',
      'color:#e8e8e8',
      'font:inherit',
      'cursor:pointer',
      'text-align:left',
    ].join(';');

    const body = document.createElement('div');
    body.id = 'engine-debug-body';
    body.style.cssText =
      'display:none;padding:8px 10px;max-height:80vh;overflow-y:auto;';

    toggle.addEventListener('click', () => {
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });

    panel.appendChild(toggle);
    panel.appendChild(body);
    return panel;
  }

  private _updateDebugPanel(
    panel: HTMLElement,
    snapshots: Snapshot[],
    choices: EnhancedChoice<Action<string, any>>[],
  ): void {
    const body = panel.querySelector('#engine-debug-body') as HTMLElement;

    const section = (label: string, open = false): HTMLDetailsElement => {
      const d = document.createElement('details');
      if (open) d.open = true;
      d.style.cssText = 'margin-bottom:6px;';
      const s = document.createElement('summary');
      s.style.cssText = 'cursor:pointer;color:#7dd3fc;margin-bottom:4px;';
      s.textContent = label;
      d.appendChild(s);
      return d;
    };

    const pre = (text: string): HTMLPreElement => {
      const p = document.createElement('pre');
      p.style.cssText =
        'margin:0;white-space:pre-wrap;word-break:break-all;color:#d4d4d4;font-size:11px;';
      p.textContent = text;
      return p;
    };

    body.replaceChildren();

    // Choices section
    const choicesSection = section(`Choices (${choices.length})`);
    if (choices.length === 0) {
      choicesSection.appendChild(pre('(none)'));
    } else {
      for (const choice of choices) {
        const d = section(`${choice.id} — ${choice.execution.$type}`);
        d.appendChild(
          pre(JSON.stringify(JSON.parse(JSON.stringify(choice)), null, 2)),
        );
        choicesSection.appendChild(d);
      }
    }
    body.appendChild(choicesSection);

    // Snapshots / dirty entities section
    const snapshotsSection = section(`Snapshots (${snapshots.length})`);
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i]!;
      const dirtyCount = Object.keys(snap.dirtyEntities).length;
      const executed = snap.executed
        ? `executed: ${(snap.executed as any).execution?.$type ?? '?'}`
        : 'no execution';
      const snapDetail = section(`[${i}] ${executed} — ${dirtyCount} dirty`);
      snapDetail.appendChild(pre(JSON.stringify(snap.dirtyEntities, null, 2)));
      snapshotsSection.appendChild(snapDetail);
    }
    body.appendChild(snapshotsSection);
  }

  private _handleChoicesClick(
    choices: EnhancedChoice<Action<string, any>>[],
  ): void {
    this._logger.debug(
      `Handling click for choices ${choices.map((c) => c.id).join(', ')}...`,
    );

    if (choices.length === 1) {
      const choice = choices[0]!;
      this._logger.debug(`Executing choice ${choice.id}...`);
      this.choiceExecuteCallback(choice.id);
    }
  }
}
