import { ModifiableRuntime } from '../interfaces/modifiable-runtime';
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
