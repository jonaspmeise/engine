import { Action } from '../../components/action';

import { NegativeRule } from '../../components/negative-rule';
import { PositiveRule } from '../../components/positive-rule';
import { Trigger } from '../../components/trigger';

export type MinimalSnapshotParameters = {
  actions: Set<Action<any>>;
  positiveRules: Set<PositiveRule>;
  negativeRules?: Set<NegativeRule>;
  triggers?: Set<Trigger>;
};

// All resolved parameters without potential undefined fields.
export type ResolvedSnapshotParameters = {
  [K in keyof MinimalSnapshotParameters]-?: NonNullable<
    MinimalSnapshotParameters[K]
  >;
};
