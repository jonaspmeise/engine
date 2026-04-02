import { Snapshot } from '@my-engine/library';
import { ClientEntityHandler } from './client-entity-handler';

/**
 * Models the internal state that a client has.
 * The entire state is updated through the server / engine.
 */
export type ClientState = {
  // TODO: Snapshot[] vs. ClientSnapshotData[]? Is the past choice data really necessary...?
  snapshots: Snapshot[];
  entityHandler: ClientEntityHandler;
};
