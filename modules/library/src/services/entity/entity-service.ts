import { Entity, entityId } from '../../components/entity';
import { EntityID } from '../../components/entity.types';
import { Class, Logger } from '../../game/game.types';
import { EntityFlushCallback } from './entity-service.types';
import {
  handler,
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
export class EntityService
  implements Clearable, Creator<Entity>, Destroyer<Entity>
{
  constructor(
    private readonly _logger: Logger, // FIXME: Make this an own type!
    private readonly _flushCallback: EntityFlushCallback,
  ) {}

  clear(): void {
    this._entities = {
      types: new Map<Class<Entity>, Set<Entity>>(),
      ids: new Map<EntityID, Entity>(),
      players: [],
      nonProxies: new WeakMap<Entity, Entity>(),
    };
  }

  private _entities = {
    types: new Map<Class<Entity>, Set<Entity>>(),
    ids: new Map<EntityID, Entity>(),
    players: [] as Array<Entity & PlayerInterface>,
    nonProxies: new WeakMap<Entity, Entity>(),
  };

  /**
   * Spawns a new entity and registers it inside the engine.
   * The entity is automatically persisted when modified.
   * @param entity The entity to spawn.
   * @returns The same entity, but enhanced to automatically notice when its state is changed.
   */
  public create<ENTITY extends Entity>(entity: ENTITY): ENTITY {
    // Set ID -> Entity mapping for extremely quick lookup of entities by singular IDs.
    const id: EntityID = entity[entityId];
    this._logger.debug(
      `Spawning entity ${entity.constructor.name} with ID ${id}.`,
    );

    const proxy = EntityService._createRecursiveProxy(
      entity,
      this._flushCallback,
      undefined,
      this._entities.ids,
    );

    if (this._entities.ids.has(id)) {
      throw new Error(`Duplicate entity ID ${id}. Entity IDs must be unique.`);
    }
    this._entities.ids.set(id, proxy);
    this._entities.nonProxies.set(proxy, entity);

    // This entity might potentially be a player...
    if (isPlayerInterface(proxy)) {
      const playerInterface = proxy as Entity & PlayerInterface;
      playerInterface[playerId] = crypto.randomUUID();

      this._logger.debug(
        () =>
          `Assigned unique player ID ${playerInterface[playerId]} to player interface ${playerInterface.constructor.name}.`,
      );

      this._entities.players.push(proxy as Entity & PlayerInterface);
    }

    // Set Type -> Entity mapping for quick lookup of entities by type.
    // Since we want individual classes to be respected, but also subclasses
    // (if A extends B, then querying for B should also return A),
    // we need to add the entity to all of its superclasses as well.
    const prototypes = EntityService.getPrototypes(entity);

    for (const prototype of prototypes) {
      if (!this._entities.types.has(prototype as Class<Entity>)) {
        this._logger.debug(
          () => `Creating new entity type set for type ${prototype?.name}.`,
        );
        this._entities.types.set(prototype as Class<Entity>, new Set());
      }

      this._entities.types.get(prototype as Class<Entity>)?.add(proxy);
    }

    // Notify the engine that state has changed.
    this._flushCallback(proxy);

    return proxy as ENTITY;
  }

  public destroy(component: Entity): void {
    const id: EntityID = component[entityId];

    this._logger.info(
      `Destroying entity ${component.constructor.name} with ID ${id}.`,
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

  public entities<TYPE extends Entity>(type: Class<TYPE>): ReadonlyArray<TYPE>;
  public entities(): ReadonlyArray<Entity>;
  public entities<TYPE extends Entity>(
    type?: Class<TYPE>,
  ): ReadonlyArray<TYPE> | ReadonlyArray<Entity> {
    if (type === undefined) {
      return Array.from(this._entities.types.get(Entity) ?? new Set());
    }

    const typed = this._entities.types.get(type);
    return typed ? Array.from(typed) : [];
  }

  public entitySet<TYPE extends Entity>(type: Class<TYPE>): ReadonlySet<TYPE>;
  public entitySet(): ReadonlySet<Entity>;
  public entitySet<TYPE extends Entity>(
    type?: Class<TYPE>,
  ): ReadonlySet<TYPE> | ReadonlySet<Entity> {
    if (type === undefined) {
      return this._entities.types.get(Entity) ?? new Set();
    }

    const typed = this._entities.types.get(type);
    return typed ?? new Set();
  }

  public anyEntity<TYPE extends Entity>(type: Class<TYPE>): TYPE | null {
    const typed = this._entities.types.get(type);
    if (typed && typed.size > 0) {
      return (typed.values().next().value as TYPE) ?? null;
    }

    return null;
  }

  public players(): ReadonlyArray<Entity & PlayerInterface> {
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
    ids?: Map<EntityID, Entity>,
  ): any => {
    const handler: ProxyHandler<any> = {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);

        // If the value is an object (and not null), wrap it in a proxy once.
        if (typeof value === 'object' && value !== null) {
          // If the value is an Entity (raw or proxy from any game instance), resolve it
          // to the canonical proxy registered in this game's entity service.
          // This ensures cross-game entity references (e.g. live proxies stored in a
          // cloned entity's properties) are transparently remapped to the local proxy.
          if (entityId in value) {
            if (ids !== undefined) {
              const canonical = ids.get((value as Entity)[entityId]);
              if (canonical !== undefined) return canonical;
            }
            return value;
          }

          return EntityService._createRecursiveProxy(
            value,
            callback,
            rootProxy || receiver,
            ids,
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

  public static getPrototypes(entity: Entity): Function[] {
    const prototypes: Function[] = [];

    let currentConstructor: Function | null = entity.constructor;
    while (
      currentConstructor !== null &&
      currentConstructor !== Object.prototype &&
      currentConstructor.name !== '' // this is some native code, that we don't care about!
    ) {
      prototypes.push(currentConstructor);

      // Move up the prototype chain to include all superclasses.
      currentConstructor = Object.getPrototypeOf(currentConstructor);
    }

    return prototypes;
  }

  public getNonProxy<T extends Entity>(entity: T): T | undefined {
    return this._entities.nonProxies.get(entity) as T | undefined;
  }

  /**
   * Extracts raw (non-proxy) clones of all currently registered entities.
   * Player handler callbacks are cleared on the clones.
   * @returns A Set of cloned raw entities.
   */
  public cloneRawEntities(): Set<Entity> {
    const result = new Set<Entity>();
    for (const entity of this.entities()) {
      const raw = this.getNonProxy(entity)!;
      const cloned = Object.create(Object.getPrototypeOf(raw)) as Entity;
      Object.defineProperties(cloned, Object.getOwnPropertyDescriptors(raw));
      if (isPlayerInterface(cloned)) {
        // @ts-ignore handler needs to be set at a later endpoint.
        cloned[handler] = undefined;
      }
      result.add(cloned);
    }
    return result;
  }

  /**
   * Creates a full clone of this EntityService with all entities re-proxied against the new flush callback.
   * @param flushCallback The flush callback for the new service instance.
   * @returns A new EntityService with identical entity state.
   */
  public clone(flushCallback: EntityFlushCallback): EntityService {
    const cloned = new EntityService(this._logger, flushCallback);
    for (const raw of this.cloneRawEntities()) {
      cloned.create(raw);
    }
    return cloned;
  }
}
