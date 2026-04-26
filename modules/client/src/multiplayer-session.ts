/// <reference lib="dom" />
import {
  entityId,
  type Action,
  type ChoiceId,
  type EnhancedChoice,
  type Snapshot,
} from '@my-engine/library';

const ENGINE_REF_PREFIX = '$ENGINE:';

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

type SetupHandler = (playerIndex: number) => void;
type StateHandler = (snapshots: Snapshot[]) => void;
type ChoicesHandler = (
  choices: EnhancedChoice<Action<string, any, any>>[],
  execute: (id: ChoiceId) => void,
) => void;
type GameOverHandler = () => void;

/**
 * Manages a WebSocket connection to a server-side game lobby.
 *
 * Register handlers first, then call `connect(lobbyId)` to open the
 * WebSocket and join (or create) a lobby on the server.
 */
export class MultiplayerSession {
  private _ws: WebSocket | null = null;
  private _onSetup: SetupHandler | null = null;
  private _onState: StateHandler | null = null;
  private _onChoices: ChoicesHandler | null = null;
  private _onGameOver: GameOverHandler | null = null;

  /** Open a WebSocket connection and join (or create) the given lobby. */
  public connect(lobbyId: string): void {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    this._ws = ws;
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'JOIN', lobbyId }));
    });
    ws.addEventListener('message', (ev: MessageEvent<string>) => {
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

  /** Send a PLAY_AGAIN vote to the server to restart the current game. */
  public playAgain(): void {
    this._ws!.send(JSON.stringify({ type: 'PLAY_AGAIN' }));
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
        this._onSetup!(payload.playerIndex);
        break;
      }
      case 'STATE': {
        const payload = msg.payload as {
          state: Array<{
            dirtyEntities: Record<string, unknown>;
            executed?:
              | {
                  $type: string;
                  parameters: Record<string, unknown> | null | undefined;
                }
              | undefined;
          }>;
        };
        const snapshots: Snapshot[] = payload.state.map((s) => ({
          dirtyEntities: s.dirtyEntities,
          executed:
            s.executed !== undefined
              ? {
                  $type: s.executed.$type,
                  parameters: resolveParams(s.executed.parameters) as Record<
                    string,
                    unknown
                  >,
                }
              : undefined,
        })) as Snapshot[];
        this._onState!(snapshots);
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
        this._onChoices!(choices, (choiceId: ChoiceId) => {
          this._ws!.send(
            JSON.stringify({ type: 'CHOICE', payload: { choiceId } }),
          );
        });
        break;
      }
      case 'GAME_OVER': {
        this._onGameOver!();
        break;
      }
    }
  }
}
