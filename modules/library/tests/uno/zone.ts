import { Entity, QueryableRuntime } from '../../src';
import { UnoCard } from './card';

export abstract class UnoZone extends Entity {
  public cards(runtime: QueryableRuntime): UnoCard[] {
    return runtime.entities(UnoCard).filter((card) => card.location === this);
  }
}
