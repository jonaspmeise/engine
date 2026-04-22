/// <reference lib="dom" />

import { entityId, type Snapshot } from '@my-engine/library';

type HistoryEntry = {
  timestamp: number;
  actionType: string | undefined;
  dirtyEntities: Record<string, string>;
};

/**
 * Encapsulates all debug-mode functionality for the browser client.
 *
 * Activation: Ctrl+Shift+Space+D toggles debug mode.
 * In debug mode:
 *  - An action log panel appears in the top-right corner showing every
 *    snapshot that was fed into the client (newest first, collapsible).
 *  - Right-clicking any DOM element whose `id` matches a known entity shows
 *    a JSON tooltip for that entity.
 */
export class DebugService {
  private _active = false;
  private _history: HistoryEntry[] = [];
  private _pressedKeys = new Set<string>();
  private _panel: HTMLElement | null = null;
  private _tooltip: HTMLElement | null = null;

  /**
   * @param getEntities A callback that returns the current live entity list.
   *   Called on right-click so it always reflects the most recent state.
   */
  constructor(private readonly _getEntities: () => ReadonlyArray<object>) {
    this._registerListeners();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Records one snapshot entry into the history and refreshes the panel when
   * debug mode is active.  Must be called *before* the entity handler applies
   * the delta so the raw delta values are captured.
   */
  public recordSnapshot(snapshot: Snapshot): void {
    const dirty: Record<string, string> = {};
    for (const [id, entity] of Object.entries(snapshot.dirtyEntities)) {
      dirty[id] = entity === null ? 'null (deleted)' : this._stringify(entity);
    }
    this._history.push({
      timestamp: Date.now(),
      actionType: snapshot.executed?.$type,
      dirtyEntities: dirty,
    });
    if (this._active) this._refreshPanel();
  }

  /** Clears the history (e.g. on game reset) and refreshes the panel. */
  public clear(): void {
    this._history = [];
    if (this._active) this._refreshPanel();
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  private _registerListeners(): void {
    document.addEventListener('keydown', (e) => {
      this._pressedKeys.add(e.code);
      if (
        e.ctrlKey &&
        e.shiftKey &&
        this._pressedKeys.has('Space') &&
        this._pressedKeys.has('KeyD')
      ) {
        e.preventDefault();
        this._toggle();
      }
    });

    document.addEventListener('keyup', (e) => {
      this._pressedKeys.delete(e.code);
    });

    document.addEventListener('contextmenu', (e) => {
      if (!this._active) return;
      const entity = this._entityFromTarget(e.target as HTMLElement);
      if (entity) {
        e.preventDefault();
        this._showTooltip(entity, e.clientX, e.clientY);
      }
    });

    document.addEventListener('click', () => this._hideTooltip());
  }

  // ── Toggle ────────────────────────────────────────────────────────────────

  private _toggle(): void {
    this._active = !this._active;
    if (this._active) {
      if (!this._panel) {
        this._panel = this._buildPanel();
        document.body.appendChild(this._panel);
      }
      this._panel.style.display = 'flex';
      this._refreshPanel();
    } else {
      if (this._panel) this._panel.style.display = 'none';
      this._hideTooltip();
    }
  }

  // ── Panel ─────────────────────────────────────────────────────────────────

  private _buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
    });

    const headerTitle = document.createElement('span');
    headerTitle.textContent = '⬡ Debug — Action Log';
    header.appendChild(headerTitle);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export JSON';
    Object.assign(exportBtn.style, {
      marginLeft: 'auto',
      cursor: 'pointer',
      letterSpacing: 'normal',
      fontWeight: 'normal',
      lineHeight: '1.6',
    });
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._exportToClipboard(exportBtn);
    });
    header.appendChild(exportBtn);

    panel.appendChild(header);

    const log = document.createElement('div');
    log.dataset.debugLog = '';
    Object.assign(log.style, { overflowY: 'auto', flex: '1' });
    panel.appendChild(log);

    return panel;
  }

  private _refreshPanel(): void {
    if (!this._panel) return;
    const log = this._panel.querySelector<HTMLElement>('[data-debug-log]');
    if (!log) return;

    log.innerHTML = '';

    for (let i = this._history.length - 1; i >= 0; i--) {
      const entry = this._history[i]!;

      const details = document.createElement('details');
      Object.assign(details.style, {
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        userSelect: 'none',
      });

      const summary = document.createElement('summary');
      Object.assign(summary.style, {
        cursor: 'pointer',
        padding: '3px 10px',
        color: entry.actionType ? '#6ee7b7' : '#64748b',
        lineHeight: '1.7',
        fontSize: '11px',
        listStyle: 'none',
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
      });
      summary.textContent = entry.actionType ?? '(initial state)';

      const badge = document.createElement('span');
      Object.assign(badge.style, {
        marginLeft: 'auto',
        color: '#64748b',
        fontSize: '10px',
        flexShrink: '0',
      });
      badge.textContent = `Δ${Object.keys(entry.dirtyEntities).length}  ${new Date(entry.timestamp).toISOString().slice(11, 23)}`;
      summary.appendChild(badge);
      details.appendChild(summary);

      const body = document.createElement('div');
      Object.assign(body.style, {
        padding: '2px 10px 6px 16px',
        userSelect: 'text',
      });

      for (const [id, json] of Object.entries(entry.dirtyEntities)) {
        const idEl = document.createElement('div');
        Object.assign(idEl.style, {
          color: '#94a3b8',
          fontSize: '10px',
          marginTop: '4px',
          wordBreak: 'break-all',
        });
        idEl.textContent = id;
        body.appendChild(idEl);

        const pre = document.createElement('pre');
        Object.assign(pre.style, {
          margin: '1px 0 0',
          color: '#e2e8f0',
          fontSize: '10px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '3px',
          padding: '3px 5px',
        });
        pre.textContent = json;
        body.appendChild(pre);
      }

      details.appendChild(body);
      log.appendChild(details);
    }
  }

  // ── Entity tooltip ────────────────────────────────────────────────────────

  private _entityFromTarget(target: HTMLElement | null): object | null {
    while (target && target !== document.body) {
      if (target.id) {
        for (const entity of this._getEntities()) {
          if ((entity as any)[entityId] === target.id) return entity;
        }
      }
      target = target.parentElement;
    }
    return null;
  }

  private _showTooltip(entity: object, x: number, y: number): void {
    this._hideTooltip();

    const tooltip = document.createElement('div');
    Object.assign(tooltip.style, {
      position: 'fixed',
      left: `${Math.min(x + 12, window.innerWidth - 420)}px`,
      top: `${Math.min(y + 8, window.innerHeight - 320)}px`,
      width: '26rem',
      maxHeight: '50vh',
      background: 'rgba(8,8,12,0.96)',
      color: '#d4d4d8',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '11px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 6px 32px rgba(0,0,0,0.7)',
      zIndex: '9001',
      overflow: 'hidden',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '4px 10px',
      background: 'rgba(110,231,183,0.1)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      color: '#6ee7b7',
      fontWeight: 'bold',
      fontSize: '10px',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    });
    header.textContent = `⬡ ${(entity as any).$type ?? 'Entity'}`;
    tooltip.appendChild(header);

    const pre = document.createElement('pre');
    Object.assign(pre.style, {
      margin: '0',
      padding: '6px 10px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      userSelect: 'text',
      fontSize: '10px',
      overflowY: 'auto',
      maxHeight: 'calc(50vh - 28px)',
    });
    pre.textContent = this._stringify(entity);
    tooltip.appendChild(pre);

    document.body.appendChild(tooltip);
    this._tooltip = tooltip;
  }

  private _hideTooltip(): void {
    this._tooltip?.remove();
    this._tooltip = null;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  private _exportToClipboard(btn: HTMLButtonElement): void {
    const data = this._history.map((entry) => {
      const dirtyEntities: Record<string, unknown> = {};
      for (const [id, json] of Object.entries(entry.dirtyEntities)) {
        try {
          dirtyEntities[id] =
            json === 'null (deleted)' ? null : JSON.parse(json);
        } catch {
          dirtyEntities[id] = json;
        }
      }
      return {
        timestamp: new Date(entry.timestamp).toISOString(),
        actionType: entry.actionType ?? null,
        dirtyEntities,
      };
    });

    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.style.color = '#6ee7b7';
      btn.style.borderColor = 'rgba(110,231,183,0.4)';
      setTimeout(() => {
        btn.textContent = original;
        btn.style.color = '#a78bfa';
        btn.style.borderColor = 'rgba(167,139,250,0.35)';
      }, 1500);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _stringify(value: unknown): string {
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'symbol') return val.toString();
        if (typeof val === 'function') return '[Function]';
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      },
      2,
    );
  }
}
