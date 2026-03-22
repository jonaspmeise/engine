import { Action } from '../../components/action';
import {
  DEFAULT_GAME_CONFIG,
  GameState,
  ResolvedGameConfig,
} from '../../game.types';
import { playerId, PlayerInterface } from '../../interfaces/player-interface';
import {
  MinimalSnapshotParameters,
  ResolvedSnapshotParameters,
} from './snapshot-service.types';

export class SnapshotService<STATE extends GameState> {
  private readonly _state: ResolvedSnapshotParameters<STATE>;

  constructor(
    state: MinimalSnapshotParameters<STATE>,
    private readonly _logger: ResolvedGameConfig['logger'] = DEFAULT_GAME_CONFIG.logger,
  ) {
    this._state = {
      ...state,
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
   * @returns The choice space for all players, resulting in all choices that players have during this snapshot.
   */
  public calculateChoices(): Set<Action<any, any>> {
    this._logger.debug(() => `Calculating choice space...`);

    const choices = new Set<Action<any, any>>();

    return choices;
  }
}
