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

export type BeforeAction<
  T extends Action<NAME, any, any>,
  NAME extends string = ActionType<T>,
> = {
  [K in `before${Capitalize<NAME>}`]: (
    runtime: ModifiableRuntime,
    parameters: ActionParametersType<T>,
  ) => void;
};

/** Indexable form of {@link BeforeAction} — use when you need to call a before-hook via a dynamic key. */
export type BeforeActionIndex = Record<
  `before${string}`,
  (runtime: ModifiableRuntime, parameters: unknown) => void
>;

export type AfterAction<
  T extends Action<NAME, any, any>,
  NAME extends string = ActionType<T>,
> = {
  [K in `after${Capitalize<NAME>}`]: (
    runtime: ModifiableRuntime,
    parameters: ActionParametersType<T>,
    returnType?: ActionReturnType<T>,
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
