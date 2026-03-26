import { ModifiableRuntime } from '../interfaces/modifiable-runtime';

export type ChoiceId = string;

/**
 * In some scenarios, the engine needs to be directly modified without going through the abstraction of an Action.
 */
export type Executable = (runtime: ModifiableRuntime) => void;
