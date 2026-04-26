/// <reference lib="dom" />
import type {
  Game,
  PlayerEntity,
  PlayerInterfaceCallback,
} from '@my-engine/library';
import type { Client } from './client';
import { MultiplayerSession } from './multiplayer-session';

export type ClientConfig<
  TClient extends Client<HTMLElement, any> = Client<HTMLElement, any>,
> = {
  /**
   * Factory that creates a fresh game instance. Called once per game start.
   * In multiplayer mode this creates a local game used only for entity-class
   * mapping (the authoritative game lives on the server).
   */
  readonly createGame: () => Game<any>;

  /**
   * Factory that creates the HTML client for a given player slot.
   * `playerIndex` is 0-based and refers to the slot returned by
   * `game.players()[playerIndex]`.
   */
  readonly createClient: (game: Game<any>, playerIndex: number) => TClient;

  /**
   * Index of the human player in `game.players()`. Defaults to `0`.
   * All other player slots are filled with the AI chosen via the selection
   * overlay in singleplayer mode.
   */
  readonly humanPlayerIndex?: number;

  /**
   * Named AI factories available in singleplayer mode. If absent or empty,
   * singleplayer is not available and the page will stay blank in `/play` mode.
   */
  readonly singleplayer?: Record<
    string,
    (game: Game<any>, player: PlayerEntity) => PlayerInterfaceCallback
  >;

  /**
   * Set to `true` if the game supports multiplayer. When `false` or absent,
   * loading the page on `/multiplayer` does nothing.
   */
  readonly multiplayer?: boolean;
};

function startSingleplayerGame<TClient extends Client<HTMLElement, any>>(
  config: ClientConfig<TClient>,
  aiFactory: (game: Game<any>, player: PlayerEntity) => PlayerInterfaceCallback,
): void {
  const game = config.createGame();
  const players = game.players();
  const humanIndex = config.humanPlayerIndex ?? 0;

  // Fill every non-human slot with the chosen AI.
  for (let i = 0; i < players.length; i++) {
    if (i === humanIndex) continue;
    const aiPlayer = players[i]!;
    game.registerPlayerCallback(aiPlayer, aiFactory(game, aiPlayer));
  }

  // Register the human player last (game starts once all players are connected).
  const humanPlayer = players[humanIndex]!;
  const client = config.createClient(game, humanIndex);
  game.registerPlayerCallback(humanPlayer, {
    state: (snapshots) => client.feedSnapshots(snapshots),
    prompt: (choices, execute) => client.feedChoices(choices, execute),
  });

  client.onResultChoice = (result) => {
    client.clear();
    if (result === 'restart') {
      startSingleplayerGame(config, aiFactory);
    } else {
      showAiSelection(config);
    }
  };
}

function showAiSelection<TClient extends Client<HTMLElement, any>>(
  config: ClientConfig<TClient>,
): void {
  const overlay = document.createElement('div');
  overlay.id = 'ai-selection-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    background: 'rgba(15,23,42,0.95)',
    zIndex: '1000',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  });

  const title = document.createElement('h2');
  title.textContent = 'Choose Opponent';
  title.style.margin = '0 0 0.5rem';
  overlay.appendChild(title);

  for (const [name, aiFactory] of Object.entries(config.singleplayer!)) {
    const btn = document.createElement('button');
    btn.textContent = name;
    Object.assign(btn.style, {
      padding: '0.75rem 2.5rem',
      fontSize: '1.1rem',
      borderRadius: '8px',
      border: 'none',
      background: '#38bdf8',
      color: '#0f172a',
      fontWeight: '700',
      cursor: 'pointer',
    });
    btn.addEventListener(
      'click',
      () => {
        overlay.remove();
        startSingleplayerGame(config, aiFactory);
      },
      { once: true },
    );
    overlay.appendChild(btn);
  }

  document.body.appendChild(overlay);
}

export function startSingleplayer<TClient extends Client<HTMLElement, any>>(
  config: ClientConfig<TClient>,
): void {
  const isMultiplayer = (window as any).__MULTIPLAYER__ === true;

  if (isMultiplayer) {
    if (!config.multiplayer) return;

    let client: TClient | null = null;
    const session = new MultiplayerSession();
    session
      .onSetup((playerIndex) => {
        client?.clear();
        const game = config.createGame();
        client = config.createClient(game, playerIndex);
        client.onResultChoice = (result) => {
          if (result === 'restart') {
            session.playAgain();
          } else {
            window.location.href = '/';
          }
        };
      })
      .onState((snapshots) => {
        client?.feedSnapshots(snapshots);
      })
      .onChoices((choices, execute) => {
        client?.feedChoices(choices, (choice) => {
          execute(typeof choice === 'number' ? choice : choice.id);
        });
      })
      .onGameOver(() => {});

    // Show lobby input — connect only after the user submits a lobby ID.
    const overlay = document.createElement('div');
    const input = document.createElement('input');
    input.placeholder = 'Lobby ID';
    const btn = document.createElement('button');
    btn.textContent = 'Join / Create';
    btn.addEventListener(
      'click',
      () => {
        overlay.remove();
        session.connect(input.value.trim() || crypto.randomUUID().slice(0, 8));
      },
      { once: true },
    );
    overlay.append(input, btn);
    document.body.appendChild(overlay);
    return;
  }

  // Singleplayer
  if (!config.singleplayer || Object.keys(config.singleplayer).length === 0)
    return;
  showAiSelection(config);
}
