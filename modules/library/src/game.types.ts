import { EnhancedChoice } from './components/choice';
import { ChoiceId } from './components/choice.types';
import { Entity } from './components/entity';

export type GameParameters = Record<string, unknown>;

export type Class<T> = abstract new (...args: any[]) => T;

export type LoggerMethod = (message: unknown | (() => unknown)) => void;

export type GameConfig = {
  logger?: Partial<Logger>;
};

export type Logger = {
  log: LoggerMethod;
  warn: LoggerMethod;
  error: LoggerMethod;
  info: LoggerMethod;
  debug: LoggerMethod;
};

export type ResolvedGameConfig = {
  logger: Logger;
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
export const NO_OP_LOGGER: Logger = {
  log: NO_OP_LOGGER_METHOD,
  warn: NO_OP_LOGGER_METHOD,
  error: NO_OP_LOGGER_METHOD,
  info: NO_OP_LOGGER_METHOD,
  debug: NO_OP_LOGGER_METHOD,
};

export const DEFAULT_GAME_CONFIG: ResolvedGameConfig = {
  logger: {
    log: (message) => DEFAULT_LOGGER_METHOD(message, console.log),
    warn: (message) => DEFAULT_LOGGER_METHOD(message, console.warn),
    error: (message) => DEFAULT_LOGGER_METHOD(message, console.error),
    info: (message) => DEFAULT_LOGGER_METHOD(message, console.info),
    debug: (message) => DEFAULT_LOGGER_METHOD(message, console.debug),
  },
};

export type DeepReadonly<T> = Partial<{
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P] extends Function
      ? undefined // Should not be included!
      : DeepReadonly<T[P]>;
}>;

export type PlayerInterfaceCallback = (
  // The entities, that were modified in the last snapshot.
  delta: Set<Entity>,
  choices: Set<EnhancedChoice<any, any>>, // TODO: Choice should have only a single generic - the type of its capsuled action.
  execute: (choice: EnhancedChoice<any, any> | ChoiceId) => void,
) => void;
