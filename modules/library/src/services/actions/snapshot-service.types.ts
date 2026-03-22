import { Action } from '../../components/action';

import { NegativeRule } from '../../components/negative-rule';
import { PositiveRule } from '../../components/positive-rule';
import { Trigger } from '../../components/trigger';
import { GameState } from '../../game.types';

export type MinimalSnapshotParameters<STATE extends GameState> = {
  actions: Set<Action<any, any>>;
  positiveRules: Set<PositiveRule<STATE>>;
  negativeRules?: Set<NegativeRule<STATE>>;
  triggers?: Set<Trigger>;
};

// All resolved parameters.
export type ResolvedSnapshotParameters<STATE extends GameState> = {
  [K in keyof MinimalSnapshotParameters<STATE>]: NonNullable<
    MinimalSnapshotParameters<STATE>[K]
  >;
};
