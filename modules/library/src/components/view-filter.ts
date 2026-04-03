import { Entity } from './entity';
import { Creatable } from '../interfaces/creatable';
import { Destroyable } from '../interfaces/destroyable';
import { PlayerEntity } from '../services/entity/entity-service.types';

/**
 * A view filter is a component that determines what a specific player can see about an entity.
 * When an entity is marked dirty, all registered view filters are applied for each player,
 * producing a potentially different (partially-hidden) representation per player.
 */
export abstract class ViewFilter implements Creatable, Destroyable {
  /**
   * Applies this filter to a given entity from the perspective of a player.
   * Returning the entity unchanged means the player can see all of its information.
   * Returning a modified copy (e.g. with certain fields set to null) hides that information.
   * @param player The player whose perspective is used.
   * @param entity The entity to potentially filter.
   * @returns The (possibly modified) entity as seen by the player.
   */
  abstract apply<ENTITY extends Entity>(entity: ENTITY): ENTITY;

  /**
   * Returns the player for which this view filter is applicable.
   */
  abstract readonly player: PlayerEntity;
}
