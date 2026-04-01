import { Snapshot } from '@my-engine/library';
import { EntityService } from '../../library/src/services/entity/entity-service';

/**
 * Models the internal state that a client has.
 * The entire state is updated through the server / engine.
 */
export type ClientState = {
  // TODO: Snapshot[] vs. ClientSnapshotData[]? Is the past choice data really necessary...?
  snapshots: Snapshot[];
  entityService: EntityService;
};
