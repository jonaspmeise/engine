import { Action } from './components/action';
import { EnhancedChoice } from './components/choice';
import { ChoiceId } from './components/choice.types';
import { Entity } from './components/entity';
import { PlayerInterface } from './interfaces/player-interface';

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

type AnyEntity = Record<string, unknown> & Entity;

export type PlayerInterfaceCallback = (
  // The entities, that were modified in the last snapshot.
  delta: Set<DeepReadonly<AnyEntity>>,
  choices: EnhancedChoice<Action<any>>[],
  execute: (choice: EnhancedChoice<Action<any>> | ChoiceId) => void,
) => void;

/**
 * This models data that defines the content of a snapshot and what is sent to the player.
 */
export type SnapshotData = {
  dirtyEntities: Set<DeepReadonly<AnyEntity>>;
  choices: Map<PlayerInterface, EnhancedChoice<Action<any>>[]>;
  executedChoices: EnhancedChoice<Action<any>>[];
};

/**
 * The data that is sent to the client.
 * It needs to be serializable and include all information necessary for the client to properly visualize the game state.
 */
export type ClientSnapshotData = {
  delta: DeepReadonly<AnyEntity>[];
  choices: EnhancedChoice<Action<any>>[];
};
