import { ModifiableRuntime } from '../game/modifiable-runtime';
import { Action } from './action';

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
export type BeforeAction<
  T extends Action<NAME, any, any>,
  NAME extends string = ActionType<T>,
> = {
  [K in `before${Capitalize<NAME>}`]: (
    runtime: ModifiableRuntime,
    parameters: ActionParametersType<T>,
  ) => boolean | void;
};

/** Indexable form of {@link BeforeAction} — use when you need to call a before-hook via a dynamic key. */
export type BeforeActionIndex = Record<
  `before${string}`,
  (runtime: ModifiableRuntime, parameters: unknown) => boolean | void
>;

export type AfterAction<
  T extends Action<NAME, any, any>,
  NAME extends string = ActionType<T>,
> = {
  [K in `after${Capitalize<NAME>}`]: (
    runtime: ModifiableRuntime,
    parameters: Readonly<ActionParametersType<T>>,
    returnType?: Readonly<ActionReturnType<T>>,
  ) => void;
};

/** Indexable form of {@link AfterAction} — use when you need to call an after-hook via a dynamic key. */
export type AfterActionIndex = Record<
  `after${string}`,
  (
    runtime: ModifiableRuntime,
    parameters: unknown,
    returnType?: unknown,
  ) => void
>;

export type LifecycleType = 'before' | 'after';
