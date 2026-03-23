import { dirty, EntityID, id } from './entity.types';
export abstract class Entity {
  private [id]: EntityID | undefined;
  public [dirty]: boolean = false;

  constructor() {}

  public id(): EntityID {
    if (this[id] === undefined) {
      this[id] = this.generateId();
    }

    return this[id] as EntityID;
  }

  protected abstract generateId(): EntityID;
}
