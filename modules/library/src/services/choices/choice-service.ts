import { Action } from '../../components/action';
import { EnhancedChoice } from '../../components/choice';
import { entityId } from '../../components/entity';
import { DEFAULT_GAME_CONFIG, Logger } from '../../game.types';
import { QueryableRuntime } from '../../interfaces/queryable-runtime';
import {
  MinimalSnapshotParameters,
  ResolvedSnapshotParameters,
} from './choice-service.types';

export class ChoiceService {
  private readonly _state: ResolvedSnapshotParameters;
  private _choiceCounter: number = 0;

  constructor(
    state: MinimalSnapshotParameters,
    private readonly _logger: Logger = DEFAULT_GAME_CONFIG.logger,
  ) {
    this._state = {
      positiveRules: state.positiveRules,
      negativeRules: state.negativeRules ?? new Set(),
      triggers: state.triggers ?? new Set(),
    };

    if (this._state.positiveRules.size === 0) {
      throw new Error(
        'No positive rules provided. A game without positive rules is not possible! Please register some.',
      );
    }

    // Check for duplicate rule names!
    const ruleNames = new Set<string>();
    for (const rule of [
      ...this._state.positiveRules,
      ...this._state.negativeRules,
    ]) {
      if (ruleNames.has(rule.name)) {
        throw new Error(
          `Duplicate rule name ${rule.name} found in positive or negative rules! Please ensure all rules have unique names.`,
        );
      }
      ruleNames.add(rule.name);
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
    runtime: QueryableRuntime,
  ): Set<EnhancedChoice<Action<string, any>>> {
    this._logger.debug(() => `Calculating choice space...`);

    const choices = new Set<EnhancedChoice<Action<string, any>>>();

    for (const rule of this._state.positiveRules) {
      const generatedChoices = rule.apply(runtime);

      // If the rule does not generate any choices, we can skip it.
      if (generatedChoices) {
        this._logger.debug(
          () =>
            `Rule ${rule.name} generated ${generatedChoices.length} choices.`,
        );
        for (const choice of generatedChoices) {
          choices.add(
            EnhancedChoice.fromChoice(
              choice,
              `choice-${this._choiceCounter++}`, // TODO: This is intentional! We want to also be able to get choices that were denied, to render them correctly in the client!
            ),
          );
        }

        continue;
      }
      this._logger.debug(
        () => `Rule ${rule.name} generated no choices. Skipping...`,
      );
    }

    // Filter out choices that are prevented by any negative rule.
    outer: for (const choice of choices) {
      for (const rule of this._state.negativeRules) {
        if (rule.apply(choice, runtime)) {
          this._logger.debug(
            () =>
              `Choice ${choice.execution.$type} is prevented by rule ${rule.name}. Removing from choice space...`,
          );
          choices.delete(choice);
          continue outer;
        }
      }
    }

    // Are all players, for which choices are generated, registered in the runtime?
    for (const choice of choices) {
      if (!runtime.entitySet().has(choice.player)) {
        throw new Error(
          `Player ${choice.player[entityId]} is not registered in the runtime.`,
        );
      }
    }

    // Do all players have at least one choice?
    const playersWithChoices = new Set();
    for (const choice of choices) {
      playersWithChoices.add(choice.player);
    }

    if (playersWithChoices.size === 0) {
      throw new Error(
        `No choices generated for any player! At least one player should have at least one choice. Please check your rules!`,
      );
    }
    if (playersWithChoices.size > 1) {
      this._logger.error(
        `Multiple players have choices at the same time! This should not be happening and introduces race conditions. Please check your rules!`,
      );
    }

    return choices;
  }
}
