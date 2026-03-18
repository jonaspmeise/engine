import { Entity } from '../entity';
import { EntityID } from '../entity.types';
import { Class, GameState, ResolvedGameConfig } from '../game.types';
import { spawnEntity } from '../../../client-singleplayer/src/index';

/**
 * This class manages only the aspects that are related to entities.
 * The main game class delegates to here, sometimes.
 */
export class EntityService<STATE extends GameState> {
  constructor(private readonly _logger: ResolvedGameConfig['logger']) {}

  // TODO: Pass this into a separate component...?
  private _entities = {
    types: new Map<Class<Entity<STATE>>, Set<Entity<STATE>>>(),
    ids: new Map<EntityID, Entity<STATE>>(),
  };

  public spawnEntity(entity: Entity<STATE>): void {
    // Set ID -> Entity mapping for extremely quick lookup of entities by singular IDs.
    const id = entity.id();
    this._logger.debug(
      () => `Spawning entity ${entity.constructor.name} with ID ${id}.`,
    );

    if (this._entities.ids.has(id)) {
      throw new Error(`Duplicate entity ID ${id}. Entity IDs must be unique.`);
    }
    this._entities.ids.set(id, entity);

    // Set Type -> Entity mapping for quick lookup of entities by type.
    // Since we want individual classes to be respected, but also subclasses
    // (if A extends B, then querying for B should also return A),
    // we need to add the entity to all of its superclasses as well.
    let currentConstructor: Function | null = entity.constructor;
    while (
      currentConstructor !== null &&
      currentConstructor !== Object.prototype
    ) {
      if (
        !this._entities.types.has(currentConstructor as Class<Entity<STATE>>)
      ) {
        this._logger.debug(
          () =>
            `Creating new entity type set for type ${currentConstructor?.name}.`,
        );
        this._entities.types.set(
          currentConstructor as Class<Entity<STATE>>,
          new Set(),
        );
      }

      this._entities.types
        .get(currentConstructor as Class<Entity<STATE>>)
        ?.add(entity);

      // Move up the prototype chain to include all superclasses.
      currentConstructor = Object.getPrototypeOf(currentConstructor);
    }
  }

  public entities<TYPE extends Entity<STATE>>(
    type: Class<TYPE>,
  ): ReadonlyArray<TYPE>;
  public entities(): ReadonlyArray<Entity<STATE>>;
  public entities<TYPE extends Entity<STATE>>(
    type?: Class<TYPE>,
  ): ReadonlyArray<TYPE> | ReadonlyArray<Entity<STATE>> {
    if (type === undefined) {
      return Array.from(this._entities.types.get(Entity) ?? new Set());
    }

    const typed = this._entities.types.get(type);
    return typed ? Array.from(typed) : [];
  }

  public entitySet<TYPE extends Entity<STATE>>(
    type: Class<TYPE>,
  ): ReadonlySet<TYPE>;
  public entitySet(): ReadonlySet<Entity<STATE>>;
  public entitySet<TYPE extends Entity<STATE>>(
    type?: Class<TYPE>,
  ): ReadonlySet<TYPE> | ReadonlySet<Entity<STATE>> {
    if (type === undefined) {
      return this._entities.types.get(Entity) ?? new Set();
    }

    const typed = this._entities.types.get(type);
    return typed ?? new Set();
  }
}
