import { Action } from './components/action';
import { Choice, EnhancedChoice } from './components/choice';
import { ChoiceId } from './components/choice.types';
import { Entity } from './components/entity';
import { EntityID } from './components/entity.types';
import { TriggerReturnType } from './components/trigger';
import { PlayerInterface } from './interfaces/player-interface';
import { PlayerEntity } from './services/entity/entity-service.types';

export type GameParameters = Record<string, unknown>;

export type Class<T> = abstract new (...args: any[]) => T;

export type LoggerMethod = (...message: unknown[] | (() => unknown)[]) => void;

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
  method: LoggerMethod,
  ...message: unknown[] | (() => unknown)[]
) => {
  if (message.length === 0) {
    return;
  }

  if (typeof message[0] === 'function') {
    method(message[0]());
  } else {
    if (Array.isArray(message)) {
      method(...message);
    } else {
      method(message);
    }
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
    log: (...message: unknown[] | (() => unknown)[]) =>
      DEFAULT_LOGGER_METHOD(console.log, ...message),
    warn: (...message: unknown[] | (() => unknown)[]) =>
      DEFAULT_LOGGER_METHOD(console.warn, ...message),
    error: (...message: unknown[] | (() => unknown)[]) =>
      DEFAULT_LOGGER_METHOD(console.error, ...message),
    info: (...message: unknown[] | (() => unknown)[]) =>
      DEFAULT_LOGGER_METHOD(console.info, ...message),
    debug: (...message: unknown[] | (() => unknown)[]) =>
      DEFAULT_LOGGER_METHOD(console.debug, ...message),
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
  // The snapshots that were modified since the last inform.
  snapshots: Snapshot[],
  choices: EnhancedChoice<Action<any>>[],
  execute: (choice: EnhancedChoice<Action<any>> | ChoiceId) => void, // TODO: We probably also need to pass other callbacks - force complete snapshot data, ....
) => void;

export type Snapshot = {
  dirtyEntities: Record<EntityID, DeepReadonly<AnyEntity>>;
  executed?: Choice<Action<any>> | undefined;
};

/**
 * This models data that defines the content of a snapshot.
 */
export type SnapshotData = {
  currentSnapshots: Snapshot[];
  pastSnapshots: Snapshot[];
  // Which choices are currently available for each player?
  choices: Map<PlayerInterface, EnhancedChoice<Action<any>>[]>;
  // Which choices were executed since the last snapshot?
  queuedChoices: EnhancedChoice<Action<any>>[];
  // Which executions are currently queued to be executed?
  stack: TriggerReturnType[];
};

/**
 * The data that is sent to the client.
 * It needs to be serializable and include all information necessary for the client to properly visualize the game state.
 */
export type ClientSnapshotData = {
  snapshots: Snapshot[];
  choices: EnhancedChoice<Action<any>>[];
};

export type GameStatus = 'setup' | 'running' | 'ended';

export type GameEndParameters = {
  winners: ReadonlyArray<PlayerEntity>;
  losers: ReadonlyArray<PlayerEntity>;
  draws: ReadonlyArray<PlayerEntity>;
};

// TODO: This file is growing. Refactor to different type somewhere else?
export const randomChickenPlayer: () => PlayerInterfaceCallback =
  () => (_, choices, execute) => {
    // This player does only take random choices...
    if (choices.length > 0) {
      const choice = choices[Math.floor(Math.random() * choices.length)]!;
      execute(choice);
    }
  };

export type GameLifecycle = {
  onEnd: (status: GameEndParameters) => void;
};
