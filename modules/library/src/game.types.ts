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
export const DEFAULT_GAME_CONFIG: GameConfig = {
  logger: {
    log: (message) => DEFAULT_LOGGER_METHOD(message, console.log),
    warn: (message) => DEFAULT_LOGGER_METHOD(message, console.warn),
    error: (message) => DEFAULT_LOGGER_METHOD(message, console.error),
    info: (message) => DEFAULT_LOGGER_METHOD(message, console.info),
    debug: (message) => DEFAULT_LOGGER_METHOD(message, console.debug),
  },
};
