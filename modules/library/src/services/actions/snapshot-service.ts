import { Choice } from '../../components/choice';
import { DEFAULT_GAME_CONFIG, GameState, Logger } from '../../game.types';
import { QueryableRuntime } from '../../interfaces/queryable-runtime';
import {
  MinimalSnapshotParameters,
  ResolvedSnapshotParameters,
} from './snapshot-service.types';

export class SnapshotService<STATE extends GameState> {
  private readonly _state: ResolvedSnapshotParameters<STATE>;

  constructor(
    state: MinimalSnapshotParameters<STATE>,
    private readonly _logger: Logger = DEFAULT_GAME_CONFIG.logger,
  ) {
    this._state = {
      actions: state.actions,
      positiveRules: state.positiveRules,
      negativeRules: state.negativeRules ?? new Set(),
      triggers: state.triggers ?? new Set(),
    };

    if (this._state.actions.size === 0) {
      throw new Error(
        'No actions provided. A game without actions is not possible! Please register some.',
      );
    }

    if (this._state.positiveRules.size === 0) {
      throw new Error(
        'No positive rules provided. A game without positive rules is not possible! Please register some.',
      );
    }
  }

  /**
   * Calculates the available choice space for all players.
   * Availbale choices are all choices (that have @see Action as their base) that are generated through @see PositiveRule
   * and not prevented by any @see NegativeRule.
   * @param runtime The runtime to calculate the choice space for.
   * Choices should be generated based on the state of entities.
   * @returns The choice space for all players, resulting in all choices that players have during this snapshot.
   */
  public calculateChoices(
    runtime: QueryableRuntime<STATE>,
  ): Set<Choice<any, any>> {
    this._logger.debug(() => `Calculating choice space...`);

    const choices = new Set<Choice<any, any>>();

    for (const rule of this._state.positiveRules) {
      const generatedChoices = rule(runtime);

      // If the rule does not generate any choices, we can skip it.
      if (generatedChoices) {
        this._logger.debug(
          () =>
            `Rule ${rule.constructor.name} generated ${generatedChoices.length} choices.`,
        );
        for (const choice of generatedChoices) {
          choices.add(choice);
        }

        continue;
      }
      this._logger.debug(
        () => `Rule ${rule.constructor.name} generated no choices. Skipping...`,
      );
    }

    return choices;
  }
}
