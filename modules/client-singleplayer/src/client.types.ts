import { Action, Snapshot } from '@my-engine/library';
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

export type ActionRenderFunction<ACTION extends Action<string, any, any>> = {
  render: (choice: ACTION, execute: () => void) => Promise<void>;
  erase: (choice: ACTION) => Promise<void>;
};

export type ChoiceTypeMapping<ACTIONS extends Action<string, any, any>> = {
  [K in ACTIONS['$type']]: ActionRenderFunction<Extract<ACTIONS, { $type: K }>>;
};
