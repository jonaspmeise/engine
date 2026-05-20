/// <reference lib="dom" />
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { Players } from '@my-engine/library';
import { TicTacToeClient } from './tictactoe-client';
import type { PlayerInterfaceCallback } from '@my-engine/library';
import { TicTacToePlayer } from '../../../library/tests/tictactoe/entities/player';

type AIFactory = (game: TicTacToe) => PlayerInterfaceCallback;

function startGame(aiFactory: AIFactory): void {
  const game = new TicTacToe({ firstPlayer: 'X' });
  const aiPlayer = game.entities(TicTacToePlayer)[0]!;
  const humanPlayer = game.entities(TicTacToePlayer)[1]!;

  game.registerPlayerCallback(aiPlayer, aiFactory(game));

  const client = new TicTacToeClient(humanPlayer);
  game.registerPlayerCallback(humanPlayer, {
    state: (s) => client.feedSnapshots(s),
    prompt: (c, e) => client.feedChoices(c, e),
  });

  client.onResultChoice = (result) => {
    client.clear();
    result === 'restart' ? startGame(aiFactory) : showMenu();
  };
}

function showMenu(): void {
  const overlay = document.createElement('div');
  overlay.id = 'menu';
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
    fontFamily: 'system-ui, sans-serif',
  });

  const title = document.createElement('h2');
  title.textContent = 'Choose Opponent';
  title.style.margin = '0 0 0.5rem';
  overlay.appendChild(title);

  const ais: [string, AIFactory][] = [
    ['Chicken', () => Players.chicken()],
    ['Impossible', (g) => Players.mcts(g, g.players()[0]!, 1000)],
  ];

  for (const [name, factory] of ais) {
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
        startGame(factory);
      },
      { once: true },
    );
    overlay.appendChild(btn);
  }

  document.body.appendChild(overlay);
}

showMenu();
