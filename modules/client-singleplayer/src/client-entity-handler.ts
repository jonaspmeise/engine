import {
  Class,
  Entity,
  EntityClassMapping,
  entityId,
  EntityService,
  Logger,
  PlayerEntity,
  PlayerInterface,
  QueryableRuntime,
} from '@my-engine/library';
import { EntityID } from '../../library/src/components/entity.types';
import { ClientEntity } from './client-entity-handler.types';

export class ClientEntityHandler implements QueryableRuntime {
  constructor(
    private readonly _classMapping: EntityClassMapping,
    private readonly _logger: Logger,
  ) {}

  private _state = {
    entityByType: new Map<Class<Entity>, Entity[]>(),
    entities: [] as Entity[],
    entityById: new Map<EntityID, Entity>(),
  };

  public entities<TYPE extends Entity & PlayerInterface>(
    type: Class<TYPE>,
  ): ReadonlyArray<TYPE & PlayerInterface>;
  public entities<TYPE extends Entity>(type: Class<TYPE>): ReadonlyArray<TYPE>;
  public entities(): ReadonlyArray<Entity>;
  public entities<TYPE extends Entity>(
    type?: Class<TYPE>,
  ): ReadonlyArray<TYPE> | ReadonlyArray<Entity> {
    if (type === undefined) {
      return Array.from(this._state.entities);
    }

    const entities = this._state.entityByType.get(type as Class<Entity>);
    return entities ?? [];
  }

  public entitySet<TYPE extends Entity>(type: Class<TYPE>): ReadonlySet<TYPE>;
  public entitySet(): ReadonlySet<Entity>;
  public entitySet<TYPE extends Entity>(
    type?: Class<TYPE>,
  ): ReadonlySet<TYPE> | ReadonlySet<Entity> {
    if (type === undefined) {
      return new Set(this._state.entities);
    }

    const entities = this._state.entityByType.get(type);
    return entities ? new Set(entities as TYPE[]) : new Set<TYPE>();
  }

  public anyEntity<TYPE extends Entity>(type: Class<TYPE>): TYPE | null {
    const entities: TYPE[] | undefined = this._state.entityByType.get(type) as
      | TYPE[]
      | undefined;

    return entities ? (entities[0] ?? null) : null;
  }

  public players(): ReadonlyArray<PlayerEntity> {
    return [];
  }

  /**
   * Applies a delta of an entity to the internal state.
   * If the entity does not exist yet, it is created.
   * If the entity already exists, the delta is applied to the existing entity.
   * @param entityDelta The delta of the entity, which is applied to the internal state.
   */
  public apply(id: EntityID, entityDelta: Partial<ClientEntity>): void {
    if (this._state.entityById.has(id)) {
      const existingEntity = this._state.entityById.get(id)!;
      Object.assign(existingEntity, entityDelta);
      return;
    }

    const entity: Entity = { [entityId]: id, ...entityDelta } as Entity;
    // Manually set the prototype to our type.
    // TODO: How to we find out the entity here?
    if (this._classMapping[entity.$type] === undefined) {
      throw new Error(`Unknown entity type: ${entity.$type}`);
    }
    Object.setPrototypeOf(entity, this._classMapping[entity.$type]!.prototype);

    this._state.entityById.set(id, entity);
    this._state.entities.push(entity);

    for (const prototype of EntityService.getPrototypes(entity)) {
      if (!this._state.entityByType.has(prototype as Class<Entity>)) {
        this._state.entityByType.set(prototype as Class<Entity>, []);
      }

      this._state.entityByType
        .get(prototype as Class<Entity>)
        ?.push(entity as Entity);
    }
  }
}
