import { Entity } from './entity';
import { GameState } from './game.types';

export interface FlushableRuntime<STATE extends GameState> {
  flush(entity: Entity<STATE>): void;
}
