import { describe, test, expect, beforeEach } from 'bun:test';
import { Game } from '../src/game';
import { GameConfig, GameParameters, NO_OP_LOGGER } from '../src/game.types';
import { entityId } from '../src/components/entity';
import { timeout } from '../src/utility.spec';
import { Players } from '../src/components/players';

type Constructor<T, P> = new (params: P, config?: GameConfig) => T;

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

      test(`${this.randomPlayDepth} random plays end in a terminal state and do not throw any errors.`, (done) => {
        // GIVEN / WHEN
        // TODO: Number of players needs to be configured...?
        for (let i = 0; i < self.randomPlayDepth; i++) {
          const game = new self.GameClass(self.parameters, {
            logger: NO_OP_LOGGER,
          });

          game.registerCallbacks({
            onEnd: (status) => {
              console.log(
                `Random play ${i + 1} ended. ${status.draws.length > 0 ? 'It was a draw.' : `Winner(s): ${status.winners.map((w) => w[entityId]).join(', ')}. Loser(s): ${status.losers.map((l) => l[entityId]).join(', ')}.`}`,
              );

              if (i === self.randomPlayDepth - 1) {
                done();
              }
            },
          });

          game.registerPlayerCallback(game.players()[0]!, Players.chicken());
          game.registerPlayerCallback(game.players()[1]!, Players.chicken());
        }

        timeout(done, 10000);
      });

      test('a registered type name -> entity class mapping is given.', () => {
        // THEN
        const mapping = this.game.entityClassMapping();

        expect(mapping).toBeDefined();
        expect(mapping).not.toBeNull();
        expect(Object.keys(mapping).length).toBeGreaterThan(0);
      });

      test('a MCTS player always wins against a random chicken player.', (done) => {
        // GIVEN
        // TODO: What about games with more than 2 players?
        this.game.registerPlayerCallback(
          this.game.players()[0]!,
          Players.chicken(),
        );

        const mctsPlayer = this.game.players()[1]!;
        this.game.registerPlayerCallback(
          mctsPlayer,
          Players.mcts(this.game, mctsPlayer),
        );

        this.game.registerCallbacks({
          onEnd: (status) => {
            // THEN
            expect(status.winners).toHaveLength(1);
            expect(status.winners[0]).toBe(mctsPlayer);
            done();
          },
        });

        timeout(done, 10000);
      });

      this.additionalTests();
    });
  }
}
