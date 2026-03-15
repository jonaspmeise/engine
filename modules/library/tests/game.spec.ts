import { describe, test, expect, beforeEach } from 'bun:test';
import { Game } from '../src/game';
import { GameState, GameParameters } from '../src/game.types';
import { Entity } from '../src/entity';
import { QueryableRuntime } from '../src/queryable-runtime';

type Constructor<T, P> = new (params: P) => T;

export abstract class GameTest<
  STATE extends GameState,
  PARAMETERS extends GameParameters | undefined,
> {
  abstract readonly name: string;
  abstract readonly GameClass: Constructor<Game<STATE, PARAMETERS>, PARAMETERS>;
  abstract readonly parameters: PARAMETERS;
  abstract additionalTests(): void;

  protected game!: Game<STATE, PARAMETERS>;

  run(): void {
    const self = this;

    describe(this.name, () => {
      beforeEach(() => {
        this.game = new self.GameClass(self.parameters);
      });

      test('initialize returns a non-null state object.', () => {
        // GIVEN
        const game = new self.GameClass(self.parameters);

        // WHEN
        const state = game.initialize(self.parameters);

        // THEN
        expect(state).toBeDefined();
        expect(state).not.toBeNull();
        expect(typeof state).toBe('object');
        expect(Object.keys(state).length).toBeGreaterThan(0);
      });

      test('more than one Entity is spawned initially.', () => {
        // THEN
        expect(this.game.entities().length).toBeGreaterThan(1);
      });

      this.additionalTests();
    });
  }
}
