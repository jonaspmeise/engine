import {
  Action,
  QueryableRuntime,
  entityId,
  PlayerInterface,
} from '@my-engine/library';
import { Client } from '../../src/client';
import { UnoCard } from '../../../library/tests/uno/entities/card';
import { UnoDiscardPile } from '../../../library/tests/uno/entities/discard-pile';
import { UnoDeck } from '../../../library/tests/uno/entities/deck';
import { UnoMeta } from '../../../library/tests/uno/entities/meta';
import { UnoPlayer } from '../../../library/tests/uno/entities/player';
import { Uno, UnoDefaultColors } from '../../../library/tests/uno/uno';
import { UnoPlayCardAction } from '../../../library/tests/uno/actions/play-card';
import { UnoDrawCardAction } from '../../../library/tests/uno/actions/draw-card';
import { UnoPickColorAction } from '../../../library/tests/uno/actions/pick-color';
import { UnoPassTurnAction } from '../../../library/tests/uno/actions/pass-turn';
import { ChoiceTypeMapping } from '../../src/client.types';

type UnoActions =
  | UnoPlayCardAction
  | UnoDrawCardAction
  | UnoPickColorAction
  | UnoPassTurnAction;

// Short display labels for non-numeric values.
const LABEL: Record<string, string> = {
  wild: '★',
  'wild-draw-four': '+4',
  'draw-two': '+2',
  skip: '⊘',
  reverse: '↺',
};

export class UnoClient extends Client<HTMLDivElement, UnoActions> {
  private _flyFrom: DOMRect | null = null;
  private _flyMeta: {
    color?: string;
    label?: string;
    faceDown?: boolean;
    toSelector?: string;
    toRect?: DOMRect;
    discardPrevColor?: string;
    discardPrevLabel?: string;
  } = {};

  constructor(player: PlayerInterface, playerSize: number) {
    super(
      document.getElementById('uno-target') as HTMLDivElement,
      new Uno({ playerSize }),
      player,
    );
  }

  protected async animateBefore(choice: Action<string, any>): Promise<void> {
    const type = choice.$type;
    const params = (choice as any).parameters;

    if (type === 'put_discard_pile' && !this._flyFrom) {
      // Capture card position for AI-played cards (human cards are captured at
      // click time in the choiceTypeMapping render handler). This runs before
      // render() so the card element still exists in the hand DOM.
      const cardId: string | undefined = params?.card?.[entityId];
      if (cardId) {
        const cardEl = document.getElementById(cardId);
        if (cardEl) {
          const discardEl =
            document.querySelector<HTMLElement>('.discard-card');
          this._flyFrom = cardEl.getBoundingClientRect();
          this._flyMeta = {
            color: cardEl.dataset.color,
            label: cardEl.dataset.label,
            toRect: discardEl?.getBoundingClientRect(),
            discardPrevColor: discardEl?.dataset.color,
            discardPrevLabel: discardEl?.dataset.label,
          };
        }
      }
    } else if (type === 'drawdiscard_pile' && !this._flyFrom) {
      // Capture card position for AI-played cards (human cards are captured at
      // click time in the choiceTypeMapping render handler). This runs before
      // render() so the card element still exists in the hand DOM.
      const cardId: string | undefined = params?.card?.[entityId];
      if (cardId) {
        const cardEl = document.getElementById(cardId);
        if (cardEl) {
          const discardEl =
            document.querySelector<HTMLElement>('.discard-card');
          this._flyFrom = cardEl.getBoundingClientRect();
          this._flyMeta = {
            color: cardEl.dataset.color,
            label: cardEl.dataset.label,
            toRect: discardEl?.getBoundingClientRect(),
            discardPrevColor: discardEl?.dataset.color,
            discardPrevLabel: discardEl?.dataset.label,
          };
        }
      }
    } else if (type === 'draw_card') {
      const deckEl = document.querySelector<HTMLElement>('.deck-card');
      if (deckEl) {
        const pid: string | undefined = params?.player?.[entityId];
        this._flyFrom = deckEl.getBoundingClientRect();
        this._flyMeta = {
          faceDown: true,
          toSelector: pid ? `#board-${pid} .hand` : undefined,
        };
      }
    }
  }

  protected async animateAfter(choice: Action<string, any>): Promise<void> {
    const type = choice.$type;

    if (type === 'WinGame') {
      const params = (choice as any).parameters;
      const winnerEntityId: string | undefined = params?.player?.[entityId];
      const didWin = winnerEntityId === (this.player as any)[entityId];
      await this._showResult(didWin ? 'win' : 'lose');
      return;
    }

    if (!this._flyFrom) return;
    const from = this._flyFrom;
    const meta = this._flyMeta;
    this._flyFrom = null;
    this._flyMeta = {};

    if (type === 'play_card' || type === 'put_discard_pile') {
      const discardEl = document.querySelector<HTMLElement>('.discard-card');
      const toRect = meta.toRect ?? discardEl?.getBoundingClientRect();
      if (discardEl && toRect) {
        // Capture whatever render() already put on the discard element.
        // This may differ from meta.color/meta.label when the played card was
        // hidden (no data-color on the element), so we must not rely on meta.
        const newColor = discardEl.dataset.color;
        const newLabel = discardEl.dataset.label;
        // Temporarily show the old top card so the destination doesn't flicker.
        if (meta.discardPrevColor !== undefined)
          discardEl.dataset.color = meta.discardPrevColor;
        if (meta.discardPrevLabel !== undefined)
          discardEl.dataset.label = meta.discardPrevLabel;
        await this._flyAnimation(from, toRect, meta.color, meta.label);
        // Restore the new top card using what render() set, not the played
        // card's own color (which is undefined for hidden opponent cards).
        if (newColor !== undefined) discardEl.dataset.color = newColor;
        if (newLabel !== undefined) discardEl.dataset.label = newLabel;
      }
    } else if (type === 'draw_card' && meta.toSelector) {
      const targetEl = document.querySelector<HTMLElement>(meta.toSelector);
      if (targetEl) {
        await this._flyAnimation(
          from,
          targetEl.getBoundingClientRect(),
          undefined,
          undefined,
          true,
        );
      }
    }
  }

  private _flyAnimation(
    from: DOMRect,
    to: DOMRect,
    color?: string,
    label?: string,
    faceDown = false,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const colorMap: Record<string, string> = {
        red: '#dc2626',
        yellow: '#ca8a04',
        green: '#16a34a',
        blue: '#2563eb',
        black: '#111827',
      };

      const ghost = document.createElement('div');
      Object.assign(ghost.style, {
        position: 'fixed',
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        borderRadius: `${Math.round(from.width * 0.1)}px`,
        border: '2px solid rgba(255,255,255,0.6)',
        background: faceDown
          ? 'repeating-linear-gradient(128deg,#1e3a5f 0,#1e3a5f 6px,#0d1f3c 6px,#0d1f3c 12px)'
          : color
            ? (colorMap[color] ?? '#444')
            : '#444',
        zIndex: '1000',
        pointerEvents: 'none',
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: '900',
        fontSize: `${from.height * 0.38}px`,
        textShadow: '0 2px 6px rgba(0,0,0,0.5)',
        boxShadow: '1px 3px 10px rgba(0,0,0,0.5)',
        transition: 'none',
      });
      if (label && !faceDown) ghost.textContent = label;

      document.body.appendChild(ghost);

      // Double rAF to ensure the start position is painted before transition begins.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          ghost.style.transition =
            'left 0.35s cubic-bezier(0.4,0,0.2,1), top 0.35s cubic-bezier(0.4,0,0.2,1)';
          ghost.style.left = `${to.left + (to.width - from.width) / 2}px`;
          ghost.style.top = `${to.top + (to.height - from.height) / 2}px`;
        }),
      );

      const cleanup = () => {
        ghost.remove();
        resolve();
      };
      ghost.addEventListener('transitionend', cleanup, { once: true });
      setTimeout(cleanup, 800); // Safety fallback.
    });
  }

  /** Reorders players so the human player is at index 0 (rendered at bottom). */
  private _sorted(players: readonly UnoPlayer[]): UnoPlayer[] {
    const idx = players.findIndex(
      (p) => p[entityId] === (this.player as any)[entityId],
    );
    if (idx <= 0) return [...players];
    return [...players.slice(idx), ...players.slice(0, idx)];
  }

  protected render(target: HTMLDivElement, runtime: QueryableRuntime): void {
    const deck = runtime.anyEntity(UnoDeck)!;
    const discard = runtime.anyEntity(UnoDiscardPile)!;
    const meta = runtime.anyEntity(UnoMeta);
    const currentId = meta?.currentPlayer()?.[entityId];

    // ── game table wrapper ────────────────────────────────────────────
    let table = target.querySelector<HTMLElement>('#game-table');
    if (!table) {
      table = document.createElement('div');
      table.id = 'game-table';
      target.appendChild(table);
    }

    // ── center zone (deck + discard pile) ────────────────────────────
    let center = table.querySelector<HTMLElement>('#center-zone');
    if (!center) {
      center = document.createElement('div');
      center.id = 'center-zone';
      table.appendChild(center);
    }

    // Deck
    let deckEl = center.querySelector<HTMLElement>(`#${deck[entityId]}`);
    if (!deckEl) {
      deckEl = document.createElement('div');
      deckEl.id = deck[entityId];
      deckEl.classList.add('zone-card', 'deck-card');
      center.appendChild(deckEl);
    }
    deckEl.dataset.count = runtime
      .anyEntity(UnoDeck)!
      .cards(runtime)
      .length.toString();

    // Meta indicator – doubles as the draw-chain counter.
    // Uses meta's entityId so the debug right-click tooltip exposes the full
    // meta state (direction, currentPlayerIndex, drawOverloads, …).
    const drawOverloads = meta?.drawOverloads ?? 0;
    const metaElId = meta?.[entityId] ?? 'draw-chain-counter';
    let drawChainEl = center.querySelector<HTMLElement>(`#${metaElId}`);
    if (!drawChainEl) {
      drawChainEl = document.createElement('div');
      drawChainEl.id = metaElId;
      drawChainEl.className = 'draw-chain-counter';
      center.appendChild(drawChainEl);
    }
    if (drawOverloads > 0) {
      drawChainEl.textContent = `+${drawOverloads}`;
      drawChainEl.style.setProperty('--chain', String(drawOverloads));
      drawChainEl.style.display = '';
    } else {
      drawChainEl.style.display = 'none';
    }

    // Discard pile – show top card face-up
    let discardEl = center.querySelector<HTMLElement>(`#${discard[entityId]}`);
    if (!discardEl) {
      discardEl = document.createElement('div');
      discardEl.id = discard[entityId];
      discardEl.classList.add('zone-card', 'discard-card');
      center.appendChild(discardEl);
    }

    const topcard = discard.top(runtime);
    console.log(`Top card of discard pile is:`, topcard);
    if (topcard === undefined) {
      delete discardEl.dataset.color;
      delete discardEl.dataset.label;
    } else {
      discardEl.dataset.color = topcard?.color;
      discardEl.dataset.label = topcard
        ? typeof topcard.value === 'number'
          ? String(topcard.value)
          : LABEL[topcard.value]
        : '';
    }

    // ── player boards ─────────────────────────────────────────────────
    const sorted = this._sorted([...runtime.entities(UnoPlayer)]);
    table.style.setProperty('--n', String(sorted.length));

    for (const [i, player] of sorted.entries()) {
      const boardId = `board-${player[entityId]}`;
      let board = table.querySelector<HTMLElement>(`#${boardId}`);
      if (!board) {
        board = document.createElement('div');
        board.id = boardId;
        board.classList.add('player-board');
        const nameEl = document.createElement('div');
        nameEl.classList.add('player-name');
        nameEl.textContent = player.toString();
        board.appendChild(nameEl);
        table.appendChild(board);
      }
      board.style.setProperty('--i', String(i));
      board.dataset.current = player[entityId] === currentId ? 'true' : '';

      // Hand container
      let handEl = board.querySelector<HTMLElement>('.hand');
      if (!handEl) {
        handEl = document.createElement('div');
        handEl.classList.add('hand');
        board.appendChild(handEl);
      }

      const hand = player.hand(runtime);
      const handCards = hand.cards(runtime);
      handEl.style.setProperty('--cn', String(handCards.length));

      // Remove cards that left the hand.
      const liveIds = new Set(handCards.map((c) => c[entityId]));
      for (const child of [...handEl.children]) {
        if (!liveIds.has((child as HTMLElement).id)) handEl.removeChild(child);
      }

      // Create / update individual card elements.
      for (const [ci, card] of handCards.entries()) {
        let cardEl = handEl.querySelector<HTMLElement>(`#${card[entityId]}`);
        if (!cardEl) {
          cardEl = document.createElement('div');
          cardEl.id = card[entityId];
          cardEl.classList.add('card');
          handEl.appendChild(cardEl);
        }
        cardEl.style.setProperty('--ci', String(ci));
        if (card._hidden) {
          delete cardEl.dataset.color;
          delete cardEl.dataset.label;
          cardEl.classList.add('hidden');
        } else {
          cardEl.dataset.color = card.color;
          cardEl.dataset.label =
            typeof card.value === 'number'
              ? String(card.value)
              : LABEL[card.value];
          cardEl.classList.remove('hidden');
        }
      }
    }

    // Choice picker
    let colorPicker = document.getElementById('color-pick-overlay');
    if (colorPicker === null) {
      const overlay = document.createElement('div');
      overlay.className = 'color-pick-overlay';
      overlay.id = 'color-pick-overlay';

      const panel = document.createElement('div');
      panel.className = 'color-pick-panel';

      const title = document.createElement('p');
      title.textContent = 'Pick a color';
      panel.appendChild(title);

      const buttons = document.createElement('div');
      buttons.className = 'color-pick-buttons';

      for (const color of UnoDefaultColors) {
        const button = document.createElement('button');
        button.className = `color-picker`;
        button.id = `color-pick-${color}`;
        button.dataset.color = color;
        button.title = color;
        button.setAttribute('aria-label', color);
        buttons.appendChild(button);
      }
      panel.appendChild(buttons);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      // Hide element.
      overlay.style.display = 'none';
    }
  }

  public choiceTypeMapping = {
    play_card: {
      render: async (choice: UnoPlayCardAction, execute: () => void) => {
        const el = document.getElementById(choice.parameters.card[entityId]);
        if (el) {
          el.classList.add('engine-choice');
          el.onclick = () => {
            // Capture fly animation state at click time, before any
            // render() removes the card element from the DOM.
            this._flyFrom = el.getBoundingClientRect();
            const discardEl =
              document.querySelector<HTMLElement>('.discard-card');
            this._flyMeta = {
              color: el.dataset.color,
              label: el.dataset.label,
              toRect: discardEl?.getBoundingClientRect(),
              discardPrevColor: discardEl?.dataset.color,
              discardPrevLabel: discardEl?.dataset.label,
            };
            el.classList.remove('engine-choice');
            el.onclick = null;
            execute();
          };
        }
      },
      erase: async (choice: UnoPlayCardAction) => {
        const el = document.getElementById(choice.parameters.card[entityId]);
        if (el) {
          el.classList.remove('engine-choice');
          el.onclick = null;
        }
      },
    },
    draw_card: {
      render: async (_choice: UnoDrawCardAction, execute: () => void) => {
        const deckEl = document.querySelector<HTMLElement>('.deck-card');
        if (deckEl) {
          deckEl.classList.add('engine-choice');
          deckEl.onclick = () => {
            deckEl.classList.remove('engine-choice');
            deckEl.onclick = null;
            execute();
          };
        }
      },
      erase: async (_choice: UnoDrawCardAction) => {
        const deckEl = document.querySelector<HTMLElement>('.deck-card');
        if (deckEl) {
          deckEl.classList.remove('engine-choice');
          deckEl.onclick = null;
        }
      },
    },
    pick_color: {
      // Intercepted by feedChoices override; these are never reached in normal flow.
      render: async (choice, execute) => {
        const pickElementButton = document.getElementById(
          `color-pick-${choice.parameters.color}`,
        )!;

        pickElementButton.classList.add('engine-choice');
        pickElementButton.onclick = () => {
          execute();
        };

        // Show overlay.
        const overlay = document.querySelector<HTMLElement>(
          '.color-pick-overlay',
        )!;
        overlay.style.display = 'grid';
      },
      erase: async (choice: UnoPickColorAction) => {
        // Hide overlay.
        const overlay = document.querySelector<HTMLElement>(
          '.color-pick-overlay',
        )!;
        overlay.style.display = 'none';

        // Clear button executor.
        const pickElementButton = document.getElementById(
          `color-pick-${choice.parameters.color}`,
        )!;
        pickElementButton.classList.remove('engine-choice');
        pickElementButton.onclick = null;
      },
    },
    pass_turn: {
      render: async (_choice: UnoPassTurnAction, execute: () => void) => {
        let btn = document.getElementById('pass-turn-btn');
        if (!btn) {
          btn = document.createElement('button');
          btn.id = 'pass-turn-btn';
          btn.className = 'pass-turn-btn';
          btn.textContent = 'Pass';
          document.getElementById('uno-target')!.appendChild(btn);
        }
        btn.onclick = () => {
          document.getElementById('pass-turn-btn')?.remove();
          execute();
        };
      },
      erase: async (_choice: UnoPassTurnAction) => {
        document.getElementById('pass-turn-btn')?.remove();
      },
    },
  } satisfies ChoiceTypeMapping<UnoActions>;

  private _launchFireworks(): void {
    const colors = [
      '#fbbf24',
      '#f472b6',
      '#34d399',
      '#60a5fa',
      '#a78bfa',
      '#fb923c',
    ];
    for (let b = 0; b < 7; b++) {
      setTimeout(() => {
        const burst = document.createElement('div');
        burst.className = 'firework-burst';
        burst.style.left = `${15 + Math.random() * 70}vw`;
        burst.style.top = `${10 + Math.random() * 55}vh`;
        document.body.appendChild(burst);

        const numParticles = 20;
        for (let i = 0; i < numParticles; i++) {
          const angle = (i / numParticles) * 2 * Math.PI;
          const dist = 55 + Math.random() * 90;
          const p = document.createElement('div');
          p.className = 'firework-particle';
          p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
          p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
          p.style.setProperty('--dur', `${0.65 + Math.random() * 0.55}s`);
          p.style.background =
            colors[Math.floor(Math.random() * colors.length)]!;
          burst.appendChild(p);
        }

        setTimeout(() => burst.remove(), 1600);
      }, b * 320);
    }
  }

  private _showResult(type: 'win' | 'lose'): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.getElementById('result-overlay')!;
      const text = document.getElementById('result-text')!;
      const btn = document.getElementById('play-again')!;

      const labels: Record<string, string> = {
        win: 'You Win!',
        lose: 'You Lose!',
      };

      overlay.className = `result-${type} visible`;
      text.textContent = labels[type]!;

      // Force CSS animations to replay.
      for (const el of [text, btn] as HTMLElement[]) {
        el.style.animation = 'none';
        el.offsetHeight; // force reflow
        el.style.animation = '';
      }

      if (type === 'win') {
        this._launchFireworks();
      }

      const doRestart = (): void => {
        overlay.className = '';
        this.clear();
        resolve();
      };

      btn.addEventListener(
        'click',
        (e) => {
          e.stopPropagation();
          doRestart();
        },
        { once: true },
      );

      overlay.addEventListener(
        'click',
        () => {
          overlay.className = '';
          resolve();
        },
        { once: true },
      );
    });
  }
}
