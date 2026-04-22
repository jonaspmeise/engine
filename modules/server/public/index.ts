// Main menu browser script.
// Manages WebSocket communication with the server and drives the UI.

import type { ClientMessage, ServerMessage } from '../src/messages';
import {
  getWsUrl,
  SESSION_KEY_STORAGE_KEY,
} from '../../client-singleplayer/src/multiplayer-session';

const socket = new WebSocket(getWsUrl());

// ── DOM references ────────────────────────────────────────────────────────────

const btnSingleplayer = document.getElementById(
  'singleplayer',
) as HTMLButtonElement;
const btnMultiplayer = document.getElementById(
  'multiplayer',
) as HTMLButtonElement;
const modal = document.getElementById('multiplayer-modal') as HTMLDialogElement;
const btnHost = document.getElementById('host') as HTMLButtonElement;
const btnJoin = document.getElementById('join') as HTMLButtonElement;
const lobbyInput = document.getElementById('lobby-input') as HTMLDivElement;
const lobbyIdInput = document.getElementById(
  'lobby-id-input',
) as HTMLInputElement;
const btnConfirmJoin = document.getElementById(
  'confirm-join',
) as HTMLButtonElement;
const lobbyIdDisplay = document.getElementById(
  'lobby-id-display',
) as HTMLParagraphElement;
const btnCloseModal = document.getElementById(
  'close-modal',
) as HTMLButtonElement;

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(message: ClientMessage): void {
  socket.send(JSON.stringify(message));
}

function resetModal(): void {
  btnHost.hidden = false;
  btnJoin.hidden = false;
  lobbyInput.hidden = true;
  lobbyIdDisplay.hidden = true;
  lobbyIdInput.value = '';
}

// ── Button handlers ───────────────────────────────────────────────────────────

btnSingleplayer.addEventListener('click', () => {
  window.location.href = '/play';
});

btnMultiplayer.addEventListener('click', () => {
  resetModal();
  modal.showModal();
});

btnHost.addEventListener('click', () => {
  send({ type: 'CREATE_LOBBY' });
});

btnJoin.addEventListener('click', () => {
  btnHost.hidden = true;
  btnJoin.hidden = true;
  lobbyInput.hidden = false;
  lobbyIdInput.focus();
});

btnConfirmJoin.addEventListener('click', () => {
  const id = lobbyIdInput.value.trim();
  if (!id) {
    return;
  }
  send({ type: 'JOIN_LOBBY', payload: { id } });
});

lobbyIdInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    btnConfirmJoin.click();
  }
});

btnCloseModal.addEventListener('click', () => {
  modal.close();
});

// ── WebSocket messages ────────────────────────────────────────────────────────

socket.addEventListener('message', (event: MessageEvent<string>) => {
  const message = JSON.parse(event.data) as ServerMessage;

  switch (message.type) {
    case 'LOBBY_CREATED': {
      btnHost.hidden = true;
      btnJoin.hidden = true;
      lobbyIdDisplay.textContent = message.payload.id;
      lobbyIdDisplay.hidden = false;
      break;
    }
    case 'GAME_STARTED': {
      // Persist the session key so the multiplayer page can reconnect.
      sessionStorage.setItem(
        SESSION_KEY_STORAGE_KEY,
        message.payload.sessionKey,
      );
      window.location.href = '/multiplayer';
      break;
    }
    case 'ERROR': {
      alert(`Error: ${message.payload.message}`);
      break;
    }
    default:
      break;
  }
});

socket.addEventListener('error', () => {
  console.error('[menu] WebSocket error');
});
