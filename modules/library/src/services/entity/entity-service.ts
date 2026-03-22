import { Entity } from '../../components/entity';
import { EntityID } from '../../components/entity.types';
import { Class, GameState, Logger } from '../../game.types';
import { EntityFlushCallback } from './entity-service.types';
import {
  isPlayerInterface,
  playerId,
  PlayerInterface,
} from '../../interfaces/player-interface';
import { Clearable } from '../../interfaces/clearable';
import { Creator } from '../../interfaces/creator';
import { Destroyer } from '../../interfaces/destroyer';

/**
 * This class manages only the aspects that are related to entities.
 * The main game class delegates to here, sometimes.
 */
export class EntityService<STATE extends GameState>
  implements Clearable, Creator<Entity<STATE>>, Destroyer<Entity<STATE>>
{
  constructor(
    private readonly _logger: Logger, // FIXME: Make this an own type!
    private readonly _flushCallback: EntityFlushCallback,
  ) {}

  clear(): void {
    this._entities = {
      types: new Map<Class<Entity<STATE>>, Set<Entity<STATE>>>(),
      ids: new Map<EntityID, Entity<STATE>>(),
      players: [],
    };
  }

  // TODO: Make this entire class cloneable for MCTS?
  private _entities = {
    types: new Map<Class<Entity<STATE>>, Set<Entity<STATE>>>(),
    ids: new Map<EntityID, Entity<STATE>>(),
    players: [] as Array<Entity<STATE> & PlayerInterface<STATE>>,
  };

  /**
   * Spawns a new entity and registers it inside the engine.
   * The entity is automatically persisted when modified.
   * @param entity The entity to spawn.
   * @returns The same entity, but enhanced to automatically notice when its state is changed.
   */
  public create<ENTITY extends Entity<STATE>>(entity: ENTITY): ENTITY {
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

    // This entity might potentially be a player...
    if (isPlayerInterface(proxy)) {
      const playerInterface = proxy as Entity<STATE> & PlayerInterface<STATE>;
      playerInterface[playerId] = crypto.randomUUID();

      this._logger.debug(
        () =>
          `Assigned unique player ID ${playerInterface[playerId]} to player interface ${playerInterface.constructor.name}.`,
      );

      this._entities.players.push(
        proxy as Entity<STATE> & PlayerInterface<STATE>,
      );
    }

    // Set Type -> Entity mapping for quick lookup of entities by type.
    // Since we want individual classes to be respected, but also subclasses
    // (if A extends B, then querying for B should also return A),
    // we need to add the entity to all of its superclasses as well.
    let currentConstructor: Function | null = entity.constructor;
    while (
      currentConstructor !== null &&
      currentConstructor !== Object.prototype &&
      currentConstructor.name !== '' // this is some native code, that we don't care about!
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

  public destroy(component: Entity<STATE>): void {
    const id = component.id();

    this._logger.info(
      () => `Destroying entity ${component.constructor.name} with ID ${id}.`,
    );

    if (!this._entities.ids.has(id)) {
      throw new Error(
        `Entity with ID ${id} is not registered and thus can't be deleted!`,
      );
    }

    this._entities.ids.delete(id);
    for (const type of this._entities.types.values()) {
      // FIXME: Only access the types that this entity is actually part of, instead of looping through all types.
      type.delete(component);
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

  public anyEntity<TYPE extends Entity<STATE>>(type: Class<TYPE>): TYPE | null {
    const typed = this._entities.types.get(type);
    if (typed && typed.size > 0) {
      return (typed.values().next().value as TYPE) ?? null;
    }

    return null;
  }

  public players(): ReadonlyArray<Entity<STATE> & PlayerInterface<STATE>> {
    // TODO: Other return type that is more performant than array? Maybe set? Map access?
    return this._entities.players;
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

        // If the value is an object (and not null), wrap it in a proxy once.
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

        // Trigger the callback using the original root proxy only for non-symbol properties.
        // Symbols should not be communicated to the client anyhow and are only for internal state.
        if (typeof prop !== 'symbol') {
          callback(rootProxy || receiver);
        }

        return result;
      },
    };

    return new Proxy(target, handler);
  };
}
