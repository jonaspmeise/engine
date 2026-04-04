import {
  Choice,
  Action,
  QueryableRuntime,
  entityId,
  PlayerInterface,
  DEFAULT_LOGGER,
  EnhancedChoice,
  ChoiceId,
  Snapshot,
} from '@my-engine/library';
import { Client } from '../../src/client';
import { UnoCard } from '../../../library/tests/uno/entities/card';
import { UnoDiscardPile } from '../../../library/tests/uno/entities/discard-pile';
import { UnoDeck } from '../../../library/tests/uno/entities/deck';
import { UnoMeta } from '../../../library/tests/uno/entities/meta';
import { UnoPlayer } from '../../../library/tests/uno/entities/player';
import { Uno } from '../../../library/tests/uno/uno';

// Short display labels for non-numeric values.
const LABEL: Record<string, string> = {
  wild: '★',
  'wild-draw-four': '+4',
  'draw-two': '+2',
  skip: '⊘',
  reverse: '↺',
};
const toLabel = (v: string | number | undefined): string =>
  v === undefined ? '' : (LABEL[String(v)] ?? String(v));

/** All UnoCards whose `location[entityId]` matches `zoneId`. Safe for filtered/hidden cards. */
function cardsIn(runtime: QueryableRuntime, zoneId: string): UnoCard[] {
  return (runtime.entities(UnoCard) as UnoCard[]).filter(
    (c) => c.location != null && c.location[entityId] === zoneId,
  );
}

export class UnoClient extends Client {
  private _flyFrom: DOMRect | null = null;
  private _flyMeta: {
    color?: string;
    label?: string;
    faceDown?: boolean;
    toSelector?: string;
  } = {};

  constructor(player: PlayerInterface, playerSize: number) {
    super(
      document.getElementById('uno-target') as HTMLDivElement,
      new Uno({ playerSize }),
      player,
      DEFAULT_LOGGER,
      true,
    );
  }

  /** Intercepts pick_color choices to show the color-picker modal instead of DOM highlights. */
  override async feed(
    snapshots: Snapshot[],
    choices: EnhancedChoice<Action<string, any>>[],
    execute: (choice: EnhancedChoice<Action<string, any>> | ChoiceId) => void,
  ): Promise<void> {
    const pickChoices = choices.filter(
      (c) => c.execution.$type === 'pick_color',
    );
    if (pickChoices.length > 0 && pickChoices.length === choices.length) {
      // Don't pass pick_color choices to base class — it can't find their DOM elements.
      await super.feed(snapshots, [], execute);
      await this._showColorPicker(pickChoices, execute);
      return;
    }
    await super.feed(snapshots, choices, execute);
  }

  protected async animateBefore(
    choice: Choice<Action<string, any>>,
  ): Promise<void> {
    const type = choice.execution.$type;
    const params = (choice.execution as any).parameters;

    if (type === 'play_card') {
      const cardId: string | undefined = params.card?.[entityId];
      if (cardId) {
        const cardEl = document.getElementById(cardId);
        if (cardEl) {
          this._flyFrom = cardEl.getBoundingClientRect();
          this._flyMeta = {
            color: cardEl.dataset.color,
            label: cardEl.dataset.label,
          };
        }
      }
    } else if (type === 'draw_card') {
      const deckEl = document.querySelector<HTMLElement>('.deck-card');
      if (deckEl) {
        const pid: string | undefined = params.player?.[entityId];
        this._flyFrom = deckEl.getBoundingClientRect();
        this._flyMeta = {
          faceDown: true,
          toSelector: pid ? `#board-${pid} .hand` : undefined,
        };
      }
    }
  }

  protected async animateAfter(
    choice: Choice<Action<string, any>>,
  ): Promise<void> {
    if (!this._flyFrom) return;
    const from = this._flyFrom;
    const meta = this._flyMeta;
    this._flyFrom = null;
    this._flyMeta = {};

    const type = choice.execution.$type;

    if (type === 'play_card') {
      const discardEl = document.querySelector<HTMLElement>('.discard-card');
      if (discardEl) {
        await this._flyAnimation(
          from,
          discardEl.getBoundingClientRect(),
          meta.color,
          meta.label,
        );
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

  private _showColorPicker(
    choices: EnhancedChoice<Action<string, any>>[],
    execute: (choice: EnhancedChoice<Action<string, any>> | ChoiceId) => void,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'color-pick-overlay';

      const panel = document.createElement('div');
      panel.className = 'color-pick-panel';

      const title = document.createElement('p');
      title.textContent = 'Pick a color';
      panel.appendChild(title);

      const buttons = document.createElement('div');
      buttons.className = 'color-pick-buttons';

      for (const choice of choices) {
        const color = (choice.execution as any).parameters.color as string;
        const btn = document.createElement('button');
        btn.className = 'color-pick-btn';
        btn.dataset.color = color;
        btn.title = color;
        btn.setAttribute('aria-label', color);
        btn.addEventListener(
          'click',
          () => {
            overlay.remove();
            execute(choice.id);
            resolve();
          },
          { once: true },
        );
        buttons.appendChild(btn);
      }

      panel.appendChild(buttons);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
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

  protected render(target: HTMLElement, runtime: QueryableRuntime): void {
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
    deckEl.dataset.count = String(cardsIn(runtime, deck[entityId]).length);

    // Discard pile – show top card face-up
    let discardEl = center.querySelector<HTMLElement>(`#${discard[entityId]}`);
    if (!discardEl) {
      discardEl = document.createElement('div');
      discardEl.id = discard[entityId];
      discardEl.classList.add('zone-card', 'discard-card');
      center.appendChild(discardEl);
    }
    const topCard = cardsIn(runtime, discard[entityId]).sort(
      (a, b) => (b.position ?? 0) - (a.position ?? 0),
    )[0];
    if (topCard?.color) {
      discardEl.dataset.color = topCard.color;
      discardEl.dataset.label = toLabel(topCard.value);
    } else {
      delete discardEl.dataset.color;
      delete discardEl.dataset.label;
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
      board.dataset.self =
        player[entityId] === (this.player as any)[entityId] ? 'true' : '';
      board.dataset.current = player[entityId] === currentId ? 'true' : '';

      // Hand container
      let handEl = board.querySelector<HTMLElement>('.hand');
      if (!handEl) {
        handEl = document.createElement('div');
        handEl.classList.add('hand');
        board.appendChild(handEl);
      }

      const handId = player.hand(runtime)?.[entityId];
      const handCards = handId ? cardsIn(runtime, handId) : [];
      handEl.style.setProperty('--cn', String(handCards.length));

      // Remove cards that left the hand
      const liveIds = new Set(handCards.map((c) => c[entityId]));
      for (const child of [...handEl.children]) {
        if (!liveIds.has((child as HTMLElement).id)) handEl.removeChild(child);
      }

      // Create / update individual card elements
      for (const [ci, card] of handCards.entries()) {
        let cardEl = handEl.querySelector<HTMLElement>(`#${card[entityId]}`);
        if (!cardEl) {
          cardEl = document.createElement('div');
          cardEl.id = card[entityId];
          cardEl.classList.add('card');
          handEl.appendChild(cardEl);
        }
        cardEl.style.setProperty('--ci', String(ci));
        if (card.color) {
          cardEl.dataset.color = card.color;
          cardEl.dataset.label = toLabel(card.value);
          cardEl.classList.remove('hidden');
        } else {
          delete cardEl.dataset.color;
          delete cardEl.dataset.label;
          cardEl.classList.add('hidden');
        }
      }
    }
  }

  protected highlightStyle(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      .engine-choice.card {
        filter: drop-shadow(0 0 6px gold) brightness(1.25);
        cursor: pointer;
        z-index: 10;
      }
      .engine-choice.card:hover {
        filter: drop-shadow(0 0 14px gold) brightness(1.5);
        transform: translateX(-50%) rotate(calc(var(--off, 0) * 7deg)) translateY(-1.4rem);
        z-index: 20;
      }
      .engine-choice.deck-card {
        box-shadow: 0 0 0 3px gold, 0 4px 14px rgba(0,0,0,0.55);
        cursor: pointer;
      }
    `;
    return style;
  }
}
