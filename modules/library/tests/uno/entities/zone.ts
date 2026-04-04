import { Entity, entityId, QueryableRuntime } from '../../../src';
import { UnoCard } from './card';

export abstract class UnoZone extends Entity {
  public cards(runtime: QueryableRuntime): UnoCard[] {
    return runtime
      .entities(UnoCard)
      .filter((card) => card.location[entityId] === this[entityId])
      .sort((a, b) => a.position - b.position);
  }
}
