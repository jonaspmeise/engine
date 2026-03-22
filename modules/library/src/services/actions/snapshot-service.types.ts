import { Action } from '../../components/action';
import { NegativeRule } from '../../components/negative-rule';
import { PositiveRule } from '../../components/positive-rule';
import { Trigger } from '../../components/trigger';
import { Class, GameState } from '../../game.types';

export type MinimalSnapshotParameters<STATE extends GameState> = {
  actions: Set<Class<Action<any, any>>>;
  positiveRules: Set<Class<PositiveRule<STATE>>>;
  negativeRules?: Set<Class<NegativeRule<STATE>>>;
  triggers?: Set<Class<Trigger>>;
};

// All resolved parameters.
export type ResolvedSnapshotParameters<STATE extends GameState> = {
  [K in keyof MinimalSnapshotParameters<STATE>]: NonNullable<
    MinimalSnapshotParameters<STATE>[K]
  >;
};
