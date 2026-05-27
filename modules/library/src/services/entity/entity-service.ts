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
import { Action } from '../../components/action';
import { AfterAnyAction, LifecycleType } from '../../components/lifecyclehooks';

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

  public clear(): void {
    this._entities = {
      types: new Map<Class<Entity>, Set<Entity>>(),
      ids: new Map<EntityID, Entity>(),
      players: [],
      nonProxies: new WeakMap<Entity, Entity>(),
    };
    this._hooksBefore = new Map();
    this._hooksAfter = new Map();
    this._hooksCheck = new Map();
    this._hooksAfterAny = [];
  }

  private _entities = {
    types: new Map<Class<Entity>, Set<Entity>>(),
    ids: new Map<EntityID, Entity>(),
    players: [] as Array<Entity & PlayerInterface>,
    nonProxies: new WeakMap<Entity, Entity>(),
  };

  // Three maps keyed by action $type, one per lifecycle hook kind.
  // Populated eagerly on create() by scanning the entity prototype chain for
  // hook-named methods (e.g. afterMark → 'after' / 'mark').  Updated in the
  // proxy set handler when a function-valued property that matches a hook name
  // is assigned at runtime.
  private _hooksBefore = new Map<string, Entity[]>();
  private _hooksAfter = new Map<string, Entity[]>();
  private _hooksCheck = new Map<string, Entity[]>();
  private _hooksAfterAny: Entity[] = [];

  // Hook method names that are reserved and must not be picked up by the
  // prefix scan — they are handled via their own dedicated registries instead.
  private static readonly _RESERVED_HOOK_NAMES = new Set<string>(['after']);

  private static readonly _HOOK_PREFIXES: readonly LifecycleType[] = [
    'before',
    'after',
    'check',
  ];

  private _hooksForType(hookType: LifecycleType): Map<string, Entity[]> {
    if (hookType === 'before') return this._hooksBefore;
    if (hookType === 'after') return this._hooksAfter;
    return this._hooksCheck;
  }

  /**
   * Walks the prototype chain of an entity and collects all hook method names.
   * Stops at Entity.prototype and Object.prototype (they have no hook methods).
   * Returns pairs of { hookType, actionType } — e.g. afterMark → { 'after', 'Mark' }.
   */
  private static _scanHookMethods(
    raw: Entity,
  ): Array<{ hookType: LifecycleType; actionType: string }> {
    const found: Array<{ hookType: LifecycleType; actionType: string }> = [];
    const seen = new Set<string>();

    let proto: object | null = Object.getPrototypeOf(raw);
    while (
      proto !== null &&
      proto !== Entity.prototype &&
      proto !== Object.prototype
    ) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (seen.has(key)) continue;
        seen.add(key);

        if (EntityService._RESERVED_HOOK_NAMES.has(key)) continue;

        if (
          typeof (raw as unknown as Record<string, unknown>)[key] !== 'function'
        )
          continue;

        for (const prefix of EntityService._HOOK_PREFIXES) {
          if (key.length > prefix.length && key.startsWith(prefix)) {
            const ch = key[prefix.length]!;
            if (ch >= 'A' && ch <= 'Z') {
              found.push({
                hookType: prefix,
                // Store the key in Capitalize<$type> form (first char uppercase,
                // rest as-is) so it matches the lookup in getHook().
                actionType: key.slice(prefix.length),
              });
            }
          }
        }
      }
      proto = Object.getPrototypeOf(proto);
    }

    return found;
  }

  /**
   * Registers a newly created proxy in all applicable hook maps by scanning
   * the raw entity's prototype chain.
   */
  private _indexEntityHooks(proxy: Entity, raw: Entity): void {
    for (const { hookType, actionType } of EntityService._scanHookMethods(
      raw,
    )) {
      const map = this._hooksForType(hookType);
      let list = map.get(actionType);
      if (list === undefined) {
        list = [];
        map.set(actionType, list);
      }
      list.push(proxy);
    }
    if (typeof (raw as Entity & AfterAnyAction).after === 'function') {
      this._hooksAfterAny.push(proxy);
    }
  }

  /**
   * Removes an entity proxy from every hook map entry it appears in.
   * Called on destroy().
   */
  private _removeEntityFromHooks(proxy: Entity): void {
    for (const map of [this._hooksBefore, this._hooksAfter, this._hooksCheck]) {
      for (const list of map.values()) {
        const idx = list.indexOf(proxy);
        if (idx !== -1) list.splice(idx, 1);
      }
    }
    const anyIdx = this._hooksAfterAny.indexOf(proxy);
    if (anyIdx !== -1) this._hooksAfterAny.splice(anyIdx, 1);
  }

  /**
   * Checks a single property name / value and, when it matches a hook method
   * pattern and the value is a function, registers the entity in the relevant
   * hook map.  Invoked from the proxy set handler for dynamic hook assignment.
   */
  private _maybeIndexHookProperty(
    prop: string,
    value: unknown,
    proxy: Entity,
  ): void {
    if (prop === 'after' && typeof value === 'function') {
      if (!this._hooksAfterAny.includes(proxy)) {
        this._hooksAfterAny.push(proxy);
      }
      return;
    }
    if (typeof value !== 'function') {
      return;
    }
    for (const prefix of EntityService._HOOK_PREFIXES) {
      if (prop.length > prefix.length && prop.startsWith(prefix)) {
        const ch = prop[prefix.length]!;
        if (ch >= 'A' && ch <= 'Z') {
          // Keep Capitalize<$type> form (same key as stored in _scanHookMethods).
          const actionType = prop.slice(prefix.length);
          const map = this._hooksForType(prefix);
          let list = map.get(actionType);
          if (list === undefined) {
            list = [];
            map.set(actionType, list);
          }
          if (!list.includes(proxy)) list.push(proxy);
          return;
        }
      }
    }
  }

  /**
   * Returns all entity proxies that have a lifecycle hook of the given type for
   * the given action.  O(1) map lookup — no entity scan needed at call time.
   * @param hookType  'before', 'after', or 'check'
   * @param action    The action whose hook registrations should be looked up.
   */
  /**
   * Returns all entity proxies that implement the {@link AfterAnyAction} interface.
   * These are called after every executed action, regardless of action type.
   */
  public getAfterAnyHooks(): Entity[] {
    return this._hooksAfterAny;
  }

  public getHook(
    hookType: LifecycleType,
    action: Action<string, any, any>,
  ): Entity[] {
    // Hook methods are named ${hookType}${Capitalize<$type>}, so the map key
    // is the capitalized form of the action's $type.
    const key = action.$type.charAt(0).toUpperCase() + action.$type.slice(1);
    return this._hooksForType(hookType).get(key) ?? [];
  }

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
      (prop, value, root) => this._maybeIndexHookProperty(prop, value, root),
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
          `Creating new entity type set for type ${prototype?.name}.`,
        );
        this._entities.types.set(prototype as Class<Entity>, new Set());
      }

      this._entities.types.get(prototype as Class<Entity>)?.add(proxy);
    }

    // Register the entity in the hook maps by scanning its prototype chain.
    this._indexEntityHooks(proxy, entity);

    // Notify the engine that state has changed.
    this._flushCallback(proxy, 'created');

    return proxy as ENTITY;
  }

  public destroy(entity: Entity): void {
    const id: EntityID = entity[entityId];

    this._logger.info(
      `Destroying entity ${entity.constructor.name} with ID ${id}.`,
    );

    const proxy = this._entities.ids.get(id);
    if (proxy === undefined) {
      throw new Error(
        `Entity with ID ${id} is not registered and thus can't be deleted!`,
      );
    }

    this._entities.ids.delete(id);
    for (const type of this._entities.types.values()) {
      // FIXME: Only access the types that this entity is actually part of, instead of looping through all types.
      type.delete(proxy);
    }
    this._removeEntityFromHooks(proxy);

    // Flush the entity, so that the clients know that this entity does not exist anymoore.
    this._flushCallback(proxy, 'deleted');
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

  public entityById(id: string): Entity | undefined {
    return this._entities.ids.get(id);
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
    callback: EntityFlushCallback,
    rootProxy?: any,
    ids?: Map<EntityID, Entity>,
    onHookSet?: (prop: string, value: unknown, root: Entity) => void,
  ): any => {
    const handler: ProxyHandler<any> = {
      get: (target, prop, receiver) => {
        // Built-in collections (Set, Map, Array, etc.) store data in internal slots
        // that are inaccessible through a Proxy receiver. Both accessors (e.g.
        // Set.prototype.size) and methods (e.g. Set.prototype.values) must operate
        // with `this` bound to the real target, not the proxy.
        if (
          !(target instanceof Entity) &&
          (target instanceof Set ||
            target instanceof Map ||
            target instanceof Array)
        ) {
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }

        const value = Reflect.get(target, prop, receiver);
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
            onHookSet,
          );
        }

        return value;
      },
      set: (target, prop, value, receiver) => {
        const result = Reflect.set(target, prop, value, receiver);

        // Trigger the callback using the original root proxy only for non-symbol properties.
        // Symbols should not be communicated to the client anyhow and are only for internal state.
        if (typeof prop !== 'symbol') {
          callback(rootProxy || receiver, 'updated');
          onHookSet?.(prop as string, value, rootProxy || receiver);
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
