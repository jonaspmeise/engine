import {
  Entity,
  entityId,
  ModifiableRuntime,
  QueryableRuntime,
} from '@my-engine/library';
import { StearthhoneCard } from './StearthhoneCard';
export abstract class StearthhoneZone extends Entity {
  public cards(runtime: QueryableRuntime): StearthhoneCard[] {
    return runtime
      .entities(StearthhoneCard)
      .filter((c) => c.location[entityId] === this[entityId]);
  }

  public abstract hasRoom(runtime: ModifiableRuntime): boolean;
}
