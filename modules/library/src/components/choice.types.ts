import { ModifiableRuntime } from '../game/modifiable-runtime';
import { EntityID } from './entity.types';

export type ChoiceId = number;

/**
 * In some scenarios, the engine needs to be directly modified without going through the abstraction of an Action.
 */
export type Executable = (runtime: ModifiableRuntime) => void;

/** The wire prefix used to identify serialized entity references (e.g. "$ENGINE:some-id"). */
export const ENGINE_ENTITY_PREFIX = '$ENGINE:';

export const dereferenceEntityID = (id: EntityID): string =>
  `${ENGINE_ENTITY_PREFIX}${id}`;
