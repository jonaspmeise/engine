import { EntityID } from './entity.types';
export abstract class Entity {
  constructor(public readonly id: EntityID) {}
}
