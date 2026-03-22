import { GameState } from '../game.types';
import { PlayerInterface } from '../interfaces/player-interface';
import { QueryableRuntime } from '../interfaces/queryable-runtime';
import { Action } from './action';

/**
 * A negative rule checks whether a given choice is applicable to the current game state.
 * This can be used to cleanly model denying rules without having to explicitly
 * model that logic in all positive rules.
 *
 * Checks whether a given choice is applicable for the current game state.
 * A choice is valid if there is no negative rule preventing its execution.
 * @param choice The choice to check.
 * @param player The player which owns that choice.
 * @param runtime A runtime that allows access to the game state and entities for the context of this check.
 * @returns whether the choice is valid.
 */
export type NegativeRule<STATE extends GameState> = (
  choice: Action<STATE, any>,
  player: PlayerInterface<STATE>,
  runtime: QueryableRuntime<STATE>,
) => boolean | void;
