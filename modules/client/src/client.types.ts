import { Action, Snapshot } from '@my-engine/library';
import { ClientEntityHandler } from './client-entity-handler';

/**
 * Models the internal state that a client has.
 * The entire state is updated through the server / engine.
 */
export type ClientState = {
  snapshots: Snapshot[];
  entityHandler: ClientEntityHandler;
};

/**
 * Models a function, which includes all information to render an executed action.
 * It contains all important information for the HTML client to properly render each choice.
 */
export type ActionRenderFunction<ACTION extends Action<string, any, any>> = {
  render?: (choice: ACTION, execute: () => void) => Promise<void>;
  erase?: (choice: ACTION) => Promise<void>;
  message?: (choice: ACTION) => string | string[];
  animateBefore?: (choice: ACTION) => Promise<void>;
  animateAfter?: (choice: ACTION) => Promise<void>;
};

export type ChoiceTypeMapping<ACTIONS extends Action<string, any, any>> = {
  [K in ACTIONS['$type']]: ActionRenderFunction<Extract<ACTIONS, { $type: K }>>;
};
