import { describe, test, expect } from 'bun:test';
import { entityId, Game, NO_OP_LOGGER } from '../../src';
import { BaseGameTest } from '../game.spec';
import { Uno } from './uno';
import { GameScenario, ChoiceSelector } from '../game-scenario';
import { UnoPlayer } from './entities/player';
import { UnoHand } from './entities/hand';
import { UnoMeta } from './entities/meta';
import { UnoDiscardPile } from './entities/discard-pile';
import { UnoDefaultCard } from './entities/default-card';
import { ActionCard } from './entities/action-card';
import { UnoWildCard } from './entities/wild-card';
import { UnoPlayCardAction } from './actions/play-card';
import { UnoDrawCardAction } from './actions/draw-card';

export class UnoTest extends BaseGameTest<{
  playerSize: number;
}> {
  numberOfPlayers: number = 4; // TODO: Make this initializable!
  initializer: (parameters: {
    playerSize: number;
  }) => Game<{ playerSize: number }> = (parameters) => new Uno(parameters);
  name: string = 'Uno';

  parameters = {
    playerSize: 4,
  };

  randomPlayDepth: number = 2;

  additionalTests(): void {}
}

// TODO: new UnoTest().run();

describe('Uno game behaviour', () => {
  describe('normal turn: playing a card', () => {
    test('when a playable card is played, it moves to the discard pile and the hand loses that card', async () => {
      let player1!: UnoPlayer;
      let player2!: UnoPlayer;
      let redSeven!: UnoDefaultCard;
      let hand1!: UnoHand;
      let discardPile!: UnoDiscardPile;

      const scenario = await GameScenario.from(
        new Uno({ playerSize: 2 }, { logger: NO_OP_LOGGER }),
      )
        .withGraphNode('NORMAL_TURN')
        .setup((game) => {
          player1 = game.entityById('player-1') as UnoPlayer;
          player2 = game.entityById('player-2') as UnoPlayer;
          hand1 = game.entityById('player-1-hand') as UnoHand;
          discardPile = game.entityById('discard-pile') as UnoDiscardPile;

          const redFive = game.entityById(
            'default-red-5-card',
          ) as UnoDefaultCard;
          redFive.location = discardPile;
          redFive.position = 1;

          redSeven = game.entityById('default-red-7-card') as UnoDefaultCard;
          redSeven.location = hand1;
          redSeven.position = 1;

          const redThree = game.entityById(
            'default-red-3-card',
          ) as UnoDefaultCard;
          redThree.location = hand1;
          redThree.position = 2;
        })
        .when(
          () => player1,
          (choices) =>
            choices.find(
              (c) =>
                c.execution instanceof UnoPlayCardAction &&
                (c.execution as UnoPlayCardAction).parameters.card === redSeven,
            )!,
        )
        .stop(() => player2)
        .run();

      expect(redSeven.location[entityId]).toBe(discardPile[entityId]);
      expect(hand1.cards(scenario.game)).toHaveLength(1);
    });
  });

  describe('check-draw turn: overdraw is active', () => {
    test('when drawOverloads is active, only cascade cards (+2, +4) and drawing are offered', async () => {
      let player1!: UnoPlayer;
      let drawTwo!: ActionCard;
      let wildDrawFour!: UnoWildCard;
      let redSeven!: UnoDefaultCard;
      let greenEight!: UnoDefaultCard;
      let capturedChoices: ChoiceSelector = [];

      await GameScenario.from(
        new Uno({ playerSize: 2 }, { logger: NO_OP_LOGGER }),
      )
        .withGraphNode('CHECK_DRAW')
        .setup((game) => {
          player1 = game.entityById('player-1') as UnoPlayer;
          const hand1 = game.entityById('player-1-hand') as UnoHand;
          const discardPile = game.entityById('discard-pile') as UnoDiscardPile;
          const meta = game.entityById('meta') as UnoMeta;

          const redNine = game.entityById(
            'default-red-9-card',
          ) as UnoDefaultCard;
          redNine.location = discardPile;
          redNine.position = 1;

          drawTwo = game.entityById('action-red-draw-two-card') as ActionCard;
          wildDrawFour = game.entityById(
            'wild-draw-four-0-card',
          ) as UnoWildCard;
          redSeven = game.entityById('default-red-7-card') as UnoDefaultCard;
          greenEight = game.entityById(
            'default-green-8-card',
          ) as UnoDefaultCard;

          drawTwo.location = hand1;
          drawTwo.position = 1;
          wildDrawFour.location = hand1;
          wildDrawFour.position = 2;
          redSeven.location = hand1;
          redSeven.position = 3;
          greenEight.location = hand1;
          greenEight.position = 4;

          meta.drawOverloads = 2;
        })
        .stop(
          () => player1,
          (choices) => {
            capturedChoices = choices;
          },
        )
        .run();

      expect(
        capturedChoices.filter((c) => c.execution instanceof UnoDrawCardAction),
      ).toHaveLength(1);

      const offeredIds = capturedChoices
        .filter((c) => c.execution instanceof UnoPlayCardAction)
        .map(
          (c) => (c.execution as UnoPlayCardAction).parameters.card[entityId],
        );

      expect(offeredIds).toContain(drawTwo[entityId]);
      expect(offeredIds).toContain(wildDrawFour[entityId]);
      expect(offeredIds).not.toContain(redSeven[entityId]);
      expect(offeredIds).not.toContain(greenEight[entityId]);
    });
  });
});
