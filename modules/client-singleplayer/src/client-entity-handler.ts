import {
  Class,
  DEFAULT_LOGGER,
  Entity,
  EntityClassMapping,
  entityId,
  EntityService,
  GameStatus,
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
    private readonly _logger: Logger = DEFAULT_LOGGER,
  ) {}

  status(): Readonly<GameStatus> {
    // We always consider the game to be running!
    return 'running';
  }

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

      // We re-update the prototype here, because it might have changed in the delta!
      if (
        Object.getPrototypeOf(existingEntity).constructor !==
        this._classMapping[existingEntity.$type]
      ) {
        this._changeEntityType(existingEntity, existingEntity.$type);
      }

      return;
    }

    const entity: Entity = { [entityId]: id, ...entityDelta } as Entity;
    this._changeEntityType(entity, entity.$type);

    this._state.entityById.set(id, entity);
    this._state.entities.push(entity);
  }

  /**
   * Changes the entity type for an already registered entity.
   * @param entity The entity, which type should be changed.
   * @param newType A reference to the new type (entity class) of the entity, which should be applied to the entity.
   * This class needs to exist and be registered within the entity handler's class mapping.
   */
  private _changeEntityType(entity: Entity, newType: string): void {
    // Did the entity previously already have an entity type ( === non-object prototype)?
    const priorPrototypes = EntityService.getPrototypes(entity);

    this._logger.debug(
      `Changing entity type of entity ${entity[entityId]} to ${newType}...`,
    );

    if (this._classMapping[newType] === undefined) {
      throw new Error(
        `Unknown entity type: ${newType}. Make sure this type is registered in the entity handler's class mapping.`,
      );
    }

    Object.setPrototypeOf(entity, this._classMapping[newType]!.prototype);

    // Potentially, remove the past references of this type and assign them to the new one.
    if (priorPrototypes.length > 0) {
      this._logger.debug(
        `Entity ${entity[entityId]} already had a different entity type before, updating the entity type references...`,
      );

      for (const prototype of priorPrototypes) {
        this._state.entityByType.get(prototype as Class<Entity>)?.splice(
          this._state.entityByType
            .get(prototype as Class<Entity>)!
            .findIndex((e) => e[entityId] === entity[entityId]),
          1,
        );
      }
    }

    // Set new references for the new prototype chain.
    for (const prototype of EntityService.getPrototypes(entity)) {
      if (!this._state.entityByType.has(prototype as Class<Entity>)) {
        this._state.entityByType.set(prototype as Class<Entity>, []);
      }

      this._state.entityByType
        .get(prototype as Class<Entity>)
        ?.push(entity as Entity);
    }

    return;
  }
}
