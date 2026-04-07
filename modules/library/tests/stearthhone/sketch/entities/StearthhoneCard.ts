import { Entity } from '@my-engine/library';

export abstract class StearthhoneEntity extends Entity {
  constructor(
    id: string,
    public health: number,
    public maxHealth: number,
  ) {
    super(id);
  }
}
