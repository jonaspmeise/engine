import { NodeId } from '../../components/graph/node.types';
import { FilterRule } from '../../components/rules/filter-rule';
import { GeneratorRule } from '../../components/rules/generator-rule';
import { Trigger } from '../../components/trigger';

export type MinimalSnapshotParameters<NODE extends NodeId> = {
  generatorRules: Set<GeneratorRule<NODE>>;
  filterRules?: Set<FilterRule<NODE>>;
  triggers?: Set<Trigger>;
};

// All resolved parameters without potential undefined fields.
export type ResolvedSnapshotParameters<NODE extends NodeId> = {
  [K in keyof MinimalSnapshotParameters<NODE>]-?: NonNullable<
    MinimalSnapshotParameters<NODE>[K]
  >;
};
