import { dirty, EntityID, id } from './entity.types';
import { GameState } from '../game.types';
import { QueryableRuntime } from '../interfaces/queryable-runtime';

export abstract class Entity<STATE extends GameState> {
  private [id]: EntityID | undefined;
  public [dirty]: boolean = false;

  constructor() {}

  abstract persist(state: STATE, runtime: QueryableRuntime<STATE>): void;

  public id(): EntityID {
    if (this[id] === undefined) {
      this[id] = this.generateId();
    }

    return this[id] as EntityID;
  }

  protected abstract generateId(): EntityID;
}
