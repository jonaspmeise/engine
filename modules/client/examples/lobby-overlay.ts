/// <reference lib="dom" />

/**
 * Shows a lobby-ID overlay. Pre-fills a generated ID the user can copy and
 * share, or the user can overwrite it with one received from another player.
 * Resolves with the final ID once the user confirms.
 */
export function promptLobbyId(): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      background: 'rgba(15,23,42,0.95)',
      zIndex: '1000',
      color: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
    });

    const label = document.createElement('label');
    label.textContent = 'Lobby ID';
    Object.assign(label.style, { fontSize: '1.1rem', fontWeight: '600' });

    const hint = document.createElement('p');
    hint.textContent = 'Share this ID with your opponent, or paste theirs.';
    Object.assign(hint.style, {
      margin: '0',
      fontSize: '0.85rem',
      color: '#94a3b8',
    });

    const input = document.createElement('input');
    input.value = crypto.randomUUID().slice(0, 8);
    input.select();
    Object.assign(input.style, {
      padding: '0.5rem 1rem',
      fontSize: '1rem',
      borderRadius: '6px',
      border: '1px solid #475569',
      background: '#1e293b',
      color: '#f8fafc',
      width: '260px',
      textAlign: 'center',
    });

    const btn = document.createElement('button');
    btn.textContent = 'Join / Create';
    Object.assign(btn.style, {
      padding: '0.6rem 2rem',
      fontSize: '1rem',
      borderRadius: '6px',
      border: 'none',
      background: '#38bdf8',
      color: '#0f172a',
      fontWeight: '700',
      cursor: 'pointer',
    });

    const submit = () => {
      const id = input.value.trim();
      if (!id) return;
      overlay.remove();
      resolve(id);
    };

    btn.addEventListener('click', submit, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    overlay.append(label, hint, input, btn);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}
