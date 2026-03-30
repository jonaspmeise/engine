import { describe, test, expect, beforeEach } from 'bun:test';
import { Game } from '../src/game';
import { GameParameters, randomChickenPlayer } from '../src/game.types';

type Constructor<T, P> = new (params: P) => T;

export abstract class GameTest<PARAMETERS extends GameParameters | undefined> {
  abstract readonly name: string;
  abstract readonly GameClass: Constructor<Game<PARAMETERS>, PARAMETERS>;
  abstract readonly parameters: PARAMETERS;
  abstract readonly randomPlayDepth: number;

  abstract additionalTests(): void;

  protected game!: Game<PARAMETERS>;

  run(): void {
    const self = this;

    describe(this.name, () => {
      beforeEach(() => {
        this.game = new self.GameClass(self.parameters);
      });

      test('initialize returns more than one entity.', () => {
        // GIVEN / WHEN
        const state = this.game.entities();

        // THEN
        expect(state).toBeDefined();
        expect(state).not.toBeNull();
        expect(state.length).toBeGreaterThan(0);
      });

      test('more than one Entity is spawned initially.', () => {
        // THEN
        expect(this.game.entities().length).toBeGreaterThan(1);
      });

      test(`${this.randomPlayDepth} random plays end in a terminal state and do not throw any errors.`, () => {
        // GIVEN / WHEN
        // TODO: Number of players needs to be configured...?
        this.game.registerPlayerCallback(
          this.game.players()[0]!,
          randomChickenPlayer(),
        );
        this.game.registerPlayerCallback(
          this.game.players()[1]!,
          randomChickenPlayer(),
        );
      });

      this.additionalTests();
    });
  }
}
