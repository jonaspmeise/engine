/// <reference lib="dom" />

import { entityId, type Snapshot } from '@my-engine/library';

type HistoryEntry = {
  timestamp: number;
  actionType: string | undefined;
  dirtyEntities: Record<string, string>;
};

type ChoiceEntry = {
  id: string | number;
  actionType: string;
  parameters: string;
};

/**
 * Encapsulates all debug-mode functionality for the browser client.
 *
 * Activation: Ctrl+Shift+D toggles the debug panel.
 */
export class DebugService {
  private _active = false;
  private _history: HistoryEntry[] = [];
  private _choices: ChoiceEntry[] = [];
  private _panel: HTMLElement | null = null;
  private _tooltip: HTMLElement | null = null;

  constructor(private readonly _entityProvider: () => ReadonlyArray<object>) {
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
    
    this._refreshPanel();
  }

  /**
   * Updates the list of available choices shown in the debug panel.
   * Call with an empty array when choices are erased.
   */
  public updateChoices(
    choices: ReadonlyArray<{
      id: string | number;
      execution: { $type: string; parameters?: Record<string, unknown> | null };
    }>,
  ): void {
    this._choices = choices.map((c) => ({
      id: c.id,
      actionType: c.execution.$type,
      parameters: c.execution.parameters
        ? this._stringify(c.execution.parameters)
        : '',
    }));

    this._refreshPanel();
  }

  /** Clears the history and choices (e.g. on game reset) and refreshes the panel. */
  public clear(): void {
    this._history = [];
    this._choices = [];

    this._refreshPanel();
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  private _registerListeners(): void {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        this._toggle();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (!this._active) {
        return;
      }

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
    Object.assign (panel.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      width: '320px',
      maxHeight: 'calc(100vh - 16px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: '9000',
      background: '#000',
      color: '#fff',
      font: '12px monospace',
    });

    const header = document.createElement('div');
    Object.assign(header.style, { display: 'flex', flexShrink: '0' });
    header.textContent = 'debug';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '[x]';
    closeBtn.title = 'Close (Ctrl+Shift+D)';
    Object.assign(closeBtn.style, { marginLeft: 'auto', cursor: 'pointer' });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggle();
    });
    header.appendChild(closeBtn);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = '[export]';
    Object.assign(exportBtn.style, { cursor: 'pointer' });
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._exportToClipboard(exportBtn);
    });
    header.appendChild(exportBtn);
    panel.appendChild(header);

    const choicesSection = document.createElement('div');
    choicesSection.dataset.debugChoices = '';
    Object.assign(choicesSection.style, { flexShrink: '0' });
    panel.appendChild(choicesSection);

    const log = document.createElement('div');
    log.dataset.debugLog = '';
    Object.assign(log.style, { overflowY: 'auto', flex: '1' });
    panel.appendChild(log);

    return panel;
  }

  private _refreshPanel(): void {
    if(!this._active) {
      return;
    }

    // Choices
    const choicesSection = this._panel!.querySelector<HTMLElement>('[data-debug-choices]')!;
  
    choicesSection.innerHTML = '';

    const label = document.createElement('div');
    label.textContent = `choices (${this._choices.length})`;
    choicesSection.appendChild(label);

    if (this._choices.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '—';
      choicesSection.appendChild(empty);
    } else {
      for (const choice of this._choices) {
        const row = document.createElement('div');
        let text = choice.actionType;
        if (choice.parameters) text += '  ' + choice.parameters.replace(/\s+/g, ' ').slice(0, 60);
        row.textContent = text;
        choicesSection.appendChild(row);
      }
    }

    // History
    const log = this._panel!.querySelector<HTMLElement>('[data-debug-log]')!;
    log.innerHTML = '';

    const historyLabel = document.createElement('div');
    historyLabel.textContent = 'history';
    Object.assign(historyLabel.style, { position: 'sticky', top: '0' });
    log.appendChild(historyLabel);

    for (let i = this._history.length - 1; i >= 0; i--) {
      const entry = this._history[i]!;

      const details = document.createElement('details');

      const summary = document.createElement('summary');
      summary.style.cursor = 'pointer';
      const ts = new Date(entry.timestamp).toISOString().slice(11, 23);
      const delta = Object.keys(entry.dirtyEntities).length;
      summary.textContent = `${entry.actionType ?? '(init)'}  Δ${delta}  ${ts}`;
      details.appendChild(summary);

      for (const [id, json] of Object.entries(entry.dirtyEntities)) {
        const idEl = document.createElement('div');
        idEl.textContent = id;
        details.appendChild(idEl);

        const pre = document.createElement('pre');
        Object.assign(pre.style, { whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'text' });
        pre.textContent = json;
        details.appendChild(pre);
      }

      log.appendChild(details);
    }
  }

  // ── Entity tooltip ────────────────────────────────────────────────────────

  private _entityFromTarget(target: HTMLElement | null): object | null {
    while (target && target !== document.body) {
      if (target.id) {
        for (const entity of this._entityProvider()) {
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
      overflow: 'hidden',
      zIndex: '9001',
      background: '#000',
      color: '#fff',
      font: '12px monospace',
    });

    const header = document.createElement('div');
    header.textContent = (entity as any).$type ?? 'entity';
    tooltip.appendChild(header);

    const pre = document.createElement('pre');
    Object.assign(pre.style, {
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      userSelect: 'text',
      overflowY: 'auto',
      maxHeight: 'calc(50vh - 1.5em)',
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
      btn.textContent = '[copied!]';
      setTimeout(() => { btn.textContent = original; }, 1500);
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
