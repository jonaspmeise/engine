import { Action } from '../components/action';
import { EnhancedChoice } from '../components/choice';
import { ChoiceId } from '../components/choice.types';
import { Entity } from '../components/entity';
import { EntityID } from '../components/entity.types';
import { PlayerInterface } from '../interfaces/player-interface';
import { PlayerEntity } from '../services/entity/entity-service.types';
import type { EntityService } from '../services/entity/entity-service';
import type { GraphService } from '../services/graph/graph-service';
import type { StateService } from '../services/state/state-service';

export type GameParameters = Record<string, unknown>;

export type Class<T> = abstract new (...args: any[]) => T;
export type EntityClass<T extends Entity> = (
  | (abstract new (...args: any[]) => T)
  | (new (...args: any[]) => T)
  | { readonly prototype: T } // allows classes with protected constructors
) & { readonly $type: string };

export type EntityClassMapping = Record<string, EntityClass<Entity>>;

export type LoggerMethod = (...message: unknown[]) => void;

export type GameConfig = {
  logger?: Partial<Logger>;
  /**
   * Pre-built services to inject. When provided, these replace the services that the Game constructor
   * would normally create. Intended for use by Game.clone() to transfer cloned service state without
   * relying on private field access.
   */
  services?: {
    entityService?: EntityService;
    graphService?: GraphService<string>;
    stateService?: StateService;
  };
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
  ...message: unknown[]
) => {
  if (message.length === 0) {
    return;
  }

  if (Array.isArray(message)) {
    method(...message);
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

export const DEFAULT_LOGGER: Logger = {
  log: (...message: unknown[]) =>
    DEFAULT_LOGGER_METHOD(console.log, ...message),
  warn: (...message: unknown[]) =>
    DEFAULT_LOGGER_METHOD(console.warn, ...message),
  error: (...message: unknown[]) =>
    DEFAULT_LOGGER_METHOD(console.error, ...message),
  info: (...message: unknown[]) =>
    DEFAULT_LOGGER_METHOD(console.info, ...message),
  debug: (...message: unknown[]) =>
    DEFAULT_LOGGER_METHOD(console.debug, ...message),
};

export const DEFAULT_GAME_CONFIG: ResolvedGameConfig = {
  logger: DEFAULT_LOGGER,
};

export type DeepReadonly<T> = Partial<{
  readonly [P in keyof T as T[P] extends Function
    ? never
    : P]: T[P] extends Object ? DeepReadonly<T[P]> : T[P];
}>;

type AnyEntity = Record<string, unknown> & Entity;

export type PlayerInterfaceCallback = {
  state: (
    // The snapshots that were modified since the last inform.
    snapshots: Snapshot[],
  ) => void | Promise<void>;
  prompt: <T extends EnhancedChoice<Action<string, any, any>>>(
    choices: T[],
    execute: (choice: EnhancedChoice<Action<string, any>> | ChoiceId) => void, // TODO: We probably also need to pass other callbacks - force complete snapshot data, ....
  ) => void;
};

/**
 * The definition of a snapshot.
 * A snapshot contains information about:
 * - which entities were modified since the last snapshot (dirtyEntities)
 * - which choice was executed since the last snapshot (executed)
 *
 * If an entity was deleted, the entry for that entity in dirtyEntities is null, otherwise it contains the full entity.
 */
export type Snapshot = {
  dirtyEntities: Record<EntityID, DeepReadonly<AnyEntity> | null>;
  executed?: Action<string, any, any> | undefined;
};

/**
 * Internal data structure for snapshots, which contains the full entity copies.
 */
export type InternalSnapshot = {
  dirtyEntities: Record<EntityID, Entity | null>;
  executed?: Action<string, any, any> | undefined;
};

/**
 * This models data that defines the content of a snapshot.
 */
export type SnapshotData = {
  currentSnapshots: InternalSnapshot[];
  pastSnapshots: InternalSnapshot[];
  // Which choices are currently available for each player?
  choices: Map<PlayerInterface, EnhancedChoice<Action<string, any>>[]>;
  // Which choices were executed since the last snapshot?
  queuedChoices: EnhancedChoice<Action<string, any>>[];
  // Which executions are currently queued to be executed?
  stack: EnhancedChoice<Action<string, any, any>>[];
  //  Is the current state settled, meaning that all triggers have been worked off and input of player can be accepted?
  isSettled: boolean;
  // How many choices were created so far?
  idCounter: 0;
  // The current prompt, that is being executed.
  // A reconnecting client can set up on this execution again.
  prompt: Promise<Action<string, any, any>> | null;
  // The callback for the current prompt, stored so a reconnecting player can be re-prompted.
  promptCallback:
    | ((choice: EnhancedChoice<Action<string, any>> | ChoiceId) => void)
    | null;
};

/**
 * The data that is sent to the client.
 * It needs to be serializable and include all information necessary for the client to properly visualize the game state.
 */
export type ClientSnapshotData = {
  snapshots: Snapshot[];
  choices: EnhancedChoice<Action<string, any>>[];
};

export type GameStatus = 'setup' | 'running' | 'ended';

export type GameEndParameters = {
  winners: ReadonlyArray<PlayerEntity>;
  losers: ReadonlyArray<PlayerEntity>;
  draws: ReadonlyArray<PlayerEntity>;
};

export type GameLifecycle = {
  onEnd: (status: GameEndParameters) => void;
};
