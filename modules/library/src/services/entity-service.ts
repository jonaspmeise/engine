import { Entity } from '../entity';
import { EntityID } from '../entity.types';
import { Class, GameState, ResolvedGameConfig } from '../game.types';
import { spawnEntity } from '../../../client-singleplayer/src/index';
import { EntityFlushCallback } from './entity-service.types';

/**
 * This class manages only the aspects that are related to entities.
 * The main game class delegates to here, sometimes.
 */
export class EntityService<STATE extends GameState> {
  constructor(
    private readonly _logger: ResolvedGameConfig['logger'],
    private readonly _flushCallback: EntityFlushCallback,
  ) {}

  // TODO: Pass this into a separate component...?
  private _entities = {
    types: new Map<Class<Entity<STATE>>, Set<Entity<STATE>>>(),
    ids: new Map<EntityID, Entity<STATE>>(),
  };

  /**
   * Spawns a new entity and registers it inside the engine.
   * The entity is automatically persisted when modified.
   * @param entity The entity to spawn.
   * @returns The same entity, but enhanced to automatically notice when its state is changed.
   */
  public spawn<ENTITY extends Entity<STATE>>(entity: ENTITY): ENTITY {
    // Set ID -> Entity mapping for extremely quick lookup of entities by singular IDs.
    const id = entity.id();
    this._logger.debug(
      () => `Spawning entity ${entity.constructor.name} with ID ${id}.`,
    );

    const proxy = EntityService._createRecursiveProxy(
      entity,
      this._flushCallback,
    );

    if (this._entities.ids.has(id)) {
      throw new Error(`Duplicate entity ID ${id}. Entity IDs must be unique.`);
    }
    this._entities.ids.set(id, proxy);

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
        ?.add(proxy);

      // Move up the prototype chain to include all superclasses.
      currentConstructor = Object.getPrototypeOf(currentConstructor);
    }

    // Notify the engine that state has changed.
    this._flushCallback(proxy);

    return proxy as ENTITY;
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

  public anyEntity<TYPE extends Entity<STATE>>(type: Class<TYPE>): TYPE | null {
    const typed = this._entities.types.get(type);
    if (typed && typed.size > 0) {
      return (typed.values().next().value as TYPE) ?? null;
    }

    return null;
  }

  // FIXME: PERFORMANCE: Check, whether this is actually performant enough.
  // While being ergonomic and easy to implement, it might cause performance issues if entities have a lot of nested objects or arrays that are modified frequently.
  // Alternatively, we can either:
  // - check manually which objects are not equal.
  // - simply always flush/recreate all entities every tick, with disregard to proxies.
  private static _createRecursiveProxy = (
    target: any,
    callback: (root: any) => void,
    rootProxy?: any,
  ): any => {
    const handler: ProxyHandler<any> = {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);

        // If the value is an object (and not null), wrap it in a proxy too
        if (typeof value === 'object' && value !== null) {
          return EntityService._createRecursiveProxy(
            value,
            callback,
            rootProxy || receiver,
          );
        }

        return value;
      },
      set: (target, prop, value, receiver) => {
        const result = Reflect.set(target, prop, value, receiver);

        // Trigger the callback using the original root proxy
        callback(rootProxy || receiver);

        return result;
      },
    };

    return new Proxy(target, handler);
  };
}
