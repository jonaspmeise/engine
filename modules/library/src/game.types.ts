import { Action } from './action';

export type GameState = Record<string, unknown>;

export type GameParameters = Record<string, unknown>;

export type Class<T> = abstract new (...args: any[]) => T;

export type LoggerMethod = (message: unknown | (() => unknown)) => void;

export type GameConfig = {
  logger?: Partial<ResolvedGameConfig['logger']>;
};

export type ResolvedGameConfig = {
  logger: {
    log: LoggerMethod;
    warn: LoggerMethod;
    error: LoggerMethod;
    info: LoggerMethod;
    debug: LoggerMethod;
  };
};

export const DEFAULT_LOGGER_METHOD = (
  message: unknown | (() => unknown),
  method: LoggerMethod,
) => {
  if (typeof message === 'function') {
    method(message());
  } else {
    method(message);
  }
};

export const NO_OP_LOGGER_METHOD: LoggerMethod = () => {};
export const NO_OP_LOGGER: ResolvedGameConfig['logger'] = {
  log: NO_OP_LOGGER_METHOD,
  warn: NO_OP_LOGGER_METHOD,
  error: NO_OP_LOGGER_METHOD,
  info: NO_OP_LOGGER_METHOD,
  debug: NO_OP_LOGGER_METHOD,
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  logger: {
    log: (message) => DEFAULT_LOGGER_METHOD(message, console.log),
    warn: (message) => DEFAULT_LOGGER_METHOD(message, console.warn),
    error: (message) => DEFAULT_LOGGER_METHOD(message, console.error),
    info: (message) => DEFAULT_LOGGER_METHOD(message, console.info),
    debug: (message) => DEFAULT_LOGGER_METHOD(message, console.debug),
  },
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object | Function
    ? DeepReadonly<T[P]>
    : T[P];
};

export type PlayerInterfaceCallback<STATE extends GameState> = (
  delta: DeepReadonly<STATE>,
  choices: Action<STATE, any>[],
) => void;
