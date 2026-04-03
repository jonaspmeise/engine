import { Entity } from '../../components/entity';
import { EntityID } from '../../components/entity.types';
import { ViewFilter } from '../../components/view-filter';
import { DeepReadonly, Logger, NO_OP_LOGGER, Snapshot } from '../../game.types';
import { Creator } from '../../interfaces/creator';
import { Destroyer } from '../../interfaces/destroyer';
import { PlayerInterface, playerId } from '../../interfaces/player-interface';
import { PlayerEntity } from '../entity/entity-service.types';

type AnyEntity = Record<string, unknown> & Entity;

/**
 * Manages all registered view filters and maintains per-player filtered entity views.
 * When an entity is marked dirty, all filters for each player are evaluated and the
 * resulting (possibly hidden) representations are stored for later retrieval.
 */
export class ViewFilterService
  implements Destroyer<ViewFilter>, Creator<ViewFilter>
{
  private readonly _filters = new Map<PlayerInterface, Set<ViewFilter>>();

  constructor(
    /**
     * A callback that returns all currently registered players.
     * Called inside {@link handle} to build per-player views.
     */
    private readonly _logger: Logger = NO_OP_LOGGER,
  ) {}

  // ─── Creator / Destroyer ────────────────────────────────────────────────────

  /**
   * Registers a new view filter.
   * @param filter The filter to register.
   * @returns The same filter instance.
   */
  create(filter: ViewFilter): ViewFilter {
    this._logger.debug(
      () =>
        `Registering view filter ${filter.constructor.name} for player ${filter.player[playerId]}.`,
    );

    const player = filter.player;
    if (!this._filters.has(player)) {
      this._filters.set(player, new Set<ViewFilter>());
    }

    const playerFilters = this._filters.get(player)!;
    if (playerFilters.has(filter)) {
      this._logger.warn(
        () =>
          `View filter ${filter.constructor.name} is already registered for player ${filter.player[playerId]}. Ignoring duplicate registration.`,
      );
      return filter;
    }

    playerFilters.add(filter);
    return filter;
  }

  /**
   * Removes a previously registered view filter.
   * @param filter The filter to remove.
   */
  destroy(filter: ViewFilter): void {
    this._logger.debug(
      () => `Deregistering view filter ${filter.constructor.name}.`,
    );

    for (const [_player, filters] of this._filters) {
      filters.delete(filter);
    }
  }

  createSnapshotFilter(player: PlayerEntity): (snapshot: Snapshot) => Snapshot {
    this._logger.debug(
      () =>
        `Creating snapshot filter for player ${player.constructor.name} with ID ${player[playerId]}.`,
    );

    const filters = this._filters.get(player);

    if (!filters || filters.size === 0) {
      this._logger.debug(
        () =>
          `No view filters registered for player ${player.constructor.name} with ID ${player[playerId]}. Returning identity filter.`,
      );
      return (snapshot: Snapshot) => snapshot;
    }

    return (snapshot: Snapshot) => ({
      executed: snapshot.executed,
      dirtyEntities: Object.fromEntries(
        Object.entries(snapshot.dirtyEntities).map(([id, entity]) => {
          let filteredEntity: AnyEntity = entity as AnyEntity;
          for (const filter of filters) {
            filteredEntity = filter.apply(filteredEntity);
          }
          return [id, filteredEntity];
        }),
      ) as Record<EntityID, DeepReadonly<AnyEntity>>,
    });
  }

  /**
   * Clears all accumulated per-player views.
   * Should be called alongside {@link StateService.clear} between snapshots.
   */
  clear(): void {
    this._filters.clear();
  }
}
