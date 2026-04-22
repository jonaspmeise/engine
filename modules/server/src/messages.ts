// ── Client → Server ───────────────────────────────────────────────────────────

export type JoinLobbyMessage = {
  readonly type: 'JOIN_LOBBY';
  readonly payload: { readonly id: string; readonly data?: unknown };
};

export type CreateLobbyMessage = {
  readonly type: 'CREATE_LOBBY';
  readonly payload?: { readonly data?: unknown };
};

export type RequestStateMessage = {
  readonly type: 'REQUEST_STATE';
};

export type ChoiceMessage = {
  readonly type: 'CHOICE';
  readonly payload: { readonly choiceId: number };
};

export type ReconnectMessage = {
  readonly type: 'RECONNECT';
  readonly payload: { readonly sessionKey: string };
};

export type PlayAgainMessage = {
  readonly type: 'PLAY_AGAIN';
};

export type ClientMessage =
  | JoinLobbyMessage
  | CreateLobbyMessage
  | RequestStateMessage
  | ChoiceMessage
  | ReconnectMessage
  | PlayAgainMessage;

// ── Server → Client ───────────────────────────────────────────────────────────

export type LobbyCreatedMessage = {
  readonly type: 'LOBBY_CREATED';
  readonly payload: { readonly id: string };
};

export type StateMessage = {
  readonly type: 'STATE';
  readonly payload: { readonly state: unknown };
};

export type ChoicesMessage = {
  readonly type: 'CHOICES';
  readonly payload: { readonly choices: readonly unknown[] };
};

export type GameOverMessage = {
  readonly type: 'GAME_OVER';
};

export type GameStartedMessage = {
  readonly type: 'GAME_STARTED';
  readonly payload: { readonly sessionKey: string };
};

export type SetupMessage = {
  readonly type: 'SETUP';
  readonly payload: { readonly playerIndex: number };
};

export type ErrorMessage = {
  readonly type: 'ERROR';
  readonly payload: { readonly message: string };
};

export type ServerMessage =
  | LobbyCreatedMessage
  | StateMessage
  | ChoicesMessage
  | GameOverMessage
  | GameStartedMessage
  | SetupMessage
  | ErrorMessage;
