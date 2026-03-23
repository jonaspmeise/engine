import { Entity } from '../components/entity';

export interface FlushableRuntime {
  flush(entity: Entity): void;
}
