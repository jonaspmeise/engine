/// <reference lib="dom" />
import {
  entityId,
  type Action,
  type ChoiceId,
  type EnhancedChoice,
  type Snapshot,
} from '@my-engine/library';

const ENGINE_REF_PREFIX = '$ENGINE:';

/**
 * Recursively replaces every "$ENGINE:<id>" placeholder string produced by
 * `EnhancedChoice.toJSON()` with a minimal entity stub that carries the
 * `entityId` symbol, which is what the client's `choiceTypeMapping.render`
 * functions use to look up DOM elements.
 */
function resolveParams(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith(ENGINE_REF_PREFIX)) {
    return { [entityId]: value.slice(ENGINE_REF_PREFIX.length) };
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        resolveParams(v),
      ]),
    );
  }
  return value;
}

// Storage key used to persist the session key between page navigations.
export const SESSION_KEY_STORAGE_KEY = 'multiplayer:sessionKey';

/** Returns the WebSocket URL for the game server based on the current page origin. */
export function getWsUrl(): string {
  return `ws://${window.location.host}/ws`;
}

type SetupHandler = (playerIndex: number) => void;
type StateHandler = (snapshots: Snapshot[]) => void;
type ChoicesHandler = (
  choices: EnhancedChoice<Action<string, any, any>>[],
  execute: (id: ChoiceId) => void,
) => void;
type GameOverHandler = () => void;

/**
 * Manages a WebSocket connection to an in-progress server-side game session.
 *
 * On construction it reads the session key from `sessionStorage`, opens a
 * WebSocket to `/ws`, and sends a `RECONNECT` message so the server can
 * map this new connection to the existing `GameSession`.
 *
 * If no session key is found the user is redirected back to the main menu.
 */
export class MultiplayerSession {
  private readonly _ws: WebSocket;
  private _onSetup: SetupHandler | null = null;
  private _onState: StateHandler | null = null;
  private _onChoices: ChoicesHandler | null = null;
  private _onGameOver: GameOverHandler | null = null;

  constructor() {
    const sessionKey = sessionStorage.getItem(SESSION_KEY_STORAGE_KEY);
    if (sessionKey === null) {
      window.location.href = '/';
      // This line is never reached; the throw satisfies the type checker.
      throw new Error('No session key found – redirecting to menu.');
    }

    this._ws = new WebSocket(getWsUrl());

    this._ws.addEventListener('open', () => {
      this._ws.send(
        JSON.stringify({ type: 'RECONNECT', payload: { sessionKey } }),
      );
    });

    this._ws.addEventListener('message', (ev: MessageEvent<string>) => {
      this._handleMessage(
        JSON.parse(ev.data) as { type: string; payload?: unknown },
      );
    });
  }

  /** Register a handler that is called once when the server sends the player's setup info (which player index they are). */
  public onSetup(handler: SetupHandler): this {
    this._onSetup = handler;
    return this;
  }

  /** Register a handler that is called whenever the server sends new game state. */
  public onState(handler: StateHandler): this {
    this._onState = handler;
    return this;
  }

  /** Register a handler that is called whenever the server sends available choices. */
  public onChoices(handler: ChoicesHandler): this {
    this._onChoices = handler;
    return this;
  }

  /** Register a handler that is called when the game ends. */
  public onGameOver(handler: GameOverHandler): this {
    this._onGameOver = handler;
    return this;
  }

  private _handleMessage(msg: { type: string; payload?: unknown }): void {
    if (
      this._onSetup === null ||
      this._onChoices === null ||
      this._onState === null ||
      this._onGameOver === null
    ) {
      console.warn(
        '[MultiplayerSession] Received message before handlers were registered. Unregistered handlers are: ',
        {
          onSetup: this._onSetup === null,
          onChoices: this._onChoices === null,
          onState: this._onState === null,
          onGameOver: this._onGameOver === null,
        },
      );
    }
    console.debug(
      `[MultiplayerSession] Received message of type ${msg.type}`,
      msg.payload,
    );
    switch (msg.type) {
      case 'SETUP': {
        const payload = msg.payload as { playerIndex: number };
        this._onSetup?.(payload.playerIndex);
        break;
      }
      case 'STATE': {
        const payload = msg.payload as { state: Snapshot[] };
        this._onState?.(payload.state);
        break;
      }
      case 'CHOICES': {
        const raw = msg.payload as {
          choices: Array<{
            id: number;
            execution: {
              type: string;
              parameters: Record<string, unknown> | null | undefined;
            };
          }>;
        };
        // EnhancedChoice.toJSON() serialises $type as "type" and replaces
        // entity references with "$ENGINE:<id>" strings. Reconstruct the
        // shape that Client.feedChoices() expects before forwarding.
        const choices = raw.choices.map((c) => ({
          id: c.id,
          execution: {
            $type: c.execution.type,
            parameters: resolveParams(c.execution.parameters) as Record<
              string,
              unknown
            >,
          },
        })) as unknown as EnhancedChoice<Action<string, any, any>>[];
        this._onChoices?.(choices, (choiceId: ChoiceId) => {
          this._ws.send(
            JSON.stringify({ type: 'CHOICE', payload: { choiceId } }),
          );
        });
        break;
      }
      case 'GAME_OVER': {
        sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
        this._onGameOver?.();
        break;
      }
    }
  }
}
