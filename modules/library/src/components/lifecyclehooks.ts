import { ModifiableRuntime } from '../game/modifiable-runtime';
import { Action } from './action';
import { Entity } from './entity';

type ActionType<T> = T extends Action<infer TYPE, any, any> ? TYPE : never;
type ActionParametersType<T> =
  T extends Action<any, infer PARAMS, any> ? PARAMS : never;
type ActionReturnType<T> =
  T extends Action<any, any, infer RETURN> ? RETURN : never;

type LifecycleMethods<T extends Action<any, any, any>> =
  T extends Action<infer TYPE, infer PARAMS, infer RETURN>
    ? {
        [K in `on${Capitalize<TYPE>}`]: (
          runtime: ModifiableRuntime,
          parameters: PARAMS,
          returnType?: RETURN,
        ) => void;
      }
    : never;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type LifecycleHook<T extends Action<any, any, any>> =
  UnionToIntersection<LifecycleMethods<T>>;

/**
 * A before-hook for an action. This is a function that gets called before the action is executed.
 * It returns whether the action should be executed or not.
 * If it returns false, the action is prevented and will not be executed.
 * If nothing is returned, the action will be executed as normal.
 * Before-hooks may:
 * - modify the runtime (e.g. by spawning or destroying entities, executing nested actions, ...).
 * - modify the parameters of the action (e.g. by changing the properties of the parameters object).
 * However, they may not modify the return type of the action, since it is not yet known at this point.
 * If you need to modify the return type, you can use an after-hook instead.
 */
type BeforeActionHook<ACTION extends Action<string, any, any>> = (
  runtime: ModifiableRuntime,
  parameters: ActionParametersType<ACTION>,
) => Promise<boolean | void> | boolean | void;
export type BeforeAction<
  ACTION extends Action<NAME, any, any>,
  NAME extends string = ActionType<ACTION>,
> = {
  [K in `before${Capitalize<NAME>}`]: BeforeActionHook<ACTION>;
};

/** Indexable form of {@link BeforeAction} — use when you need to call a before-hook via a dynamic key. */
export type BeforeActionIndex = Record<
  `before${string}`,
  (runtime: ModifiableRuntime, parameters: unknown) => Promise<void> | void
>;

/**
 * A check hook for an action. This is a function that gets called when an action is about to be executed.
 * Checks hooks are executed and applied:
 * - when a player is about to be prompted with a set of actions (choices), all check hooks for that action are called. The choices will be filtered.
 * - the action is directly executed.
 * if any check hook returns false, the action is prevented and will not be executed.
 */
type CheckActionHook<ACTION extends Action<string, any, any>> = (
  runtime: ModifiableRuntime,
  parameters: ActionParametersType<ACTION>,
) => Promise<boolean> | boolean;
export type CheckAction<
  ACTION extends Action<string, any, any>,
  NAME extends string = ActionType<ACTION>,
> = {
  [K in `check${Capitalize<NAME>}`]: CheckActionHook<ACTION>;
};

/** Indexable form of {@link CheckAction} — use when you need to call a check-hook via a dynamic key. */
export type CheckActionIndex = Record<
  `check${string}`,
  (
    runtime: ModifiableRuntime,
    parameters: unknown,
  ) => Promise<boolean> | boolean
>;

/**
 * An after-hook for an action. This is a function that gets called after the action is executed.
 * It does not return anything, since the action is already executed at this point.
 * After-hooks may:
 * - modify the runtime (e.g. by spawning or destroying entities, executing nested actions, ...).
 */
type AfterActionHook<ACTION extends Action<string, any, any>> = (
  runtime: ModifiableRuntime,
  parameters: ActionParametersType<ACTION>,
  returnType: ActionReturnType<ACTION>,
) => Promise<void> | void;
export type AfterAction<
  ACTION extends Action<NAME, any, any>,
  NAME extends string = ActionType<ACTION>,
> = {
  [K in `after${Capitalize<NAME>}`]: AfterActionHook<ACTION>;
};

/** Indexable form of {@link AfterAction} — use when you need to call an after-hook via a dynamic key. */
export type AfterActionIndex = Record<
  `after${string}`,
  (runtime: ModifiableRuntime, parameters: unknown, returnType: unknown) => void
>;

/**
 * A generic after-hook that fires after _every_ action, regardless of its type.
 * Unlike {@link AfterAction}, this hook receives the full immutable action object
 * rather than the separated parameters and return type.
 * After-any hooks may:
 * - modify the runtime (e.g. by spawning or destroying entities, executing nested actions, ...).
 */
export interface AfterAnyAction {
  after(
    runtime: ModifiableRuntime,
    action: Action<string, any, any>,
  ): Promise<void> | void;
}

export type LifecycleType = 'before' | 'after' | 'check';

export const hasActionLifecyclehook = (
  entity: Entity,
  action: Action<string, any, any>,
  actionType: LifecycleType,
): entity is Entity &
  (
    | BeforeAction<Action<string, any, any>>
    | AfterAction<Action<string, any, any>>
    | CheckAction<Action<string, any, any>>
  ) => {
  return (
    entity instanceof Entity &&
    `${actionType}${action.$type.charAt(0).toUpperCase() + action.$type.slice(1)}` in
      entity
  );
};

export const getHook = <
  ACTION extends Action<string, any, any>,
  T extends LifecycleType,
>(
  entity: Entity,
  action: ACTION,
  actionType: T,
): T extends 'before'
  ? BeforeActionHook<ACTION>
  : T extends 'after'
    ? AfterActionHook<ACTION>
    : CheckActionHook<ACTION> => {
  const hookName = `${actionType}${action.$type.charAt(0).toUpperCase() + action.$type.slice(1)}`;

  return (entity as any)[hookName].bind(entity);
};
