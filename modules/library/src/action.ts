import { ActionParameters } from './action.types';
import { GameState } from './game.types';

export abstract class Action<
  STATE extends GameState,
  PARAMETERS extends ActionParameters,
> {
  abstract apply(state: STATE, parameters: PARAMETERS): void;
}