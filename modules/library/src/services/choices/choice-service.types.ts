import { NegativeRule } from '../../components/rules/negative-rule';
import { PositiveRule } from '../../components/rules/positive-rule';
import { Trigger } from '../../components/trigger';

export type MinimalSnapshotParameters = {
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
