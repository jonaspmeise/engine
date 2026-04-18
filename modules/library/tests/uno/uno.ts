import { Action, Class, Entity, EntityClass } from '../../src';
import { Game } from '../../src/game/game';
import { UnoDeck } from './entities/deck';
import { UnoDefaultCard } from './entities/default-card';
import { UnoDiscardPile } from './entities/discard-pile';
import { UnoHand } from './entities/hand';
import { UnoMeta } from './entities/meta';
import { UnoPlayer } from './entities/player';
import { UnoWildCard } from './entities/wild-card';
import { ActionCard } from './entities/action-card';
import { UnoCard } from './entities/card';
import { Graph } from '../../src/components/graph/graph';
import { UnoDealTopCardAction } from './actions/deal-top-card';
import { UnoDrawCardAction } from './actions/draw-card';
import { UnoEndTurnAction } from './actions/end-turn';
import { UnoPickColorAction } from './actions/pick-color';
import { UnoPlayCardAction } from './actions/play-card';
import { UnoShuffleAction } from './actions/shuffle';
import { UnoPassTurnAction } from './actions/pass-turn';
import { UnoWinGameAction } from './actions/win-game';
import { UnoPutDiscardPileAction } from './actions/put-discardpile';

export const UnoDefaultColors = ['red', 'yellow', 'green', 'blue'] as const;

export class Uno extends Game<{
  playerSize: number;
}> {
  protected initialize(parameters: { playerSize: number }): Set<Entity> {
    const entities: Set<Entity> = new Set();

    // Spawn discard pile.
    entities.add(new UnoDiscardPile());

    // Spawn deck.
    const deck = new UnoDeck();
    entities.add(deck);

    const players = [];
    for (let i = 1; i <= parameters.playerSize; i++) {
      // Spawn players.
      const player = new UnoPlayer(`player-${i}`, i);
      players.push(player);
      entities.add(player);

      // Spawn hands.
      entities.add(new UnoHand(player));
    }

    // Spawn meta object.
    entities.add(new UnoMeta(players));

    // Spawn cards.
    // Default cards.
    for (const [i, color] of UnoDefaultColors.entries()) {
      for (let value = 0; value <= 9; value++) {
        entities.add(new UnoDefaultCard(color, value, deck, 10 * i + value));
      }
    }

    // Spawn wilds cards.
    for (let i = 0; i < 4; i++) {
      entities.add(new UnoWildCard(i, 'wild', deck, 40 + i));
      entities.add(new UnoWildCard(i, 'wild-draw-four', deck, 44 + i));
    }

    // Spawn action cards (skip, reverse, draw-two) – one per color.
    for (const [i, color] of UnoDefaultColors.entries()) {
      for (const [j, value] of (
        ['skip', 'reverse', 'draw-two'] as const
      ).entries()) {
        entities.add(new ActionCard(value, color, deck, 48 + i * 3 + j));
      }
    }

    return entities;
  }
  public name: string = 'Uno';

  public rawGraph(): Graph<'INITIAL' | 'NORMAL_TURN' | 'CHECK_DRAW'> {
    return {
      INITIAL: async (runtime) => {
        // Shuffle the deck.
        await runtime.execute(
          new UnoShuffleAction({
            from: runtime.anyEntity(UnoDeck)!,
            to: runtime.anyEntity(UnoDeck)!,
          }),
        );

        // Every player draws 7 cards.
        for (const player of runtime.entities(UnoPlayer)) {
          await runtime.execute(
            new UnoDrawCardAction({
              amount: 7,
              player: player,
            }),
          );
        }

        // Deal the top card of the deck.
        await runtime.execute(new UnoDealTopCardAction());

        return 'CHECK_DRAW' as const;
      },
      CHECK_DRAW: async (runtime) => {
        const meta = runtime.anyEntity(UnoMeta)!;
        // If no cards are forced to draw, continue with the normal turn loop.
        if (meta.drawOverloads == 0) {
          return 'NORMAL_TURN';
        }

        const currentPlayer = meta.currentPlayer()!;
        const cascadeableCards = currentPlayer
          .hand(runtime)
          .cards(runtime)
          .filter((card) => card.drawCards !== undefined);

        const prompt = await runtime.prompt(currentPlayer, [
          new UnoDrawCardAction({
            amount: meta.drawOverloads,
            player: currentPlayer,
          }),
          ...cascadeableCards.map(
            (card) =>
              new UnoPlayCardAction({
                card,
              }),
          ),
        ]);

        runtime.execute(prompt);

        if (prompt instanceof UnoDrawCardAction) {
          // We reset the draw overloads.
          meta.drawOverloads = 0;
        }

        await runtime.execute(new UnoEndTurnAction());

        return 'CHECK_DRAW';
      },
      NORMAL_TURN: async (runtime) => {
        // You may play a card from your hand or draw a card.
        const currentPlayer = runtime.anyEntity(UnoMeta)!.currentPlayer();
        const topCard = runtime.anyEntity(UnoDiscardPile)!.top(runtime)!;
        const playableCards = currentPlayer
          .hand(runtime)
          .cards(runtime)
          .filter((card) => card.playableOn(topCard));

        await runtime.execute(
          await runtime.prompt(currentPlayer, [
            new UnoDrawCardAction({
              amount: 1,
              player: currentPlayer,
            }),
            ...playableCards.map(
              (card) =>
                new UnoPlayCardAction({
                  card,
                }),
            ),
          ]),
        );

        // End your turn.
        await runtime.execute(new UnoEndTurnAction());

        return 'CHECK_DRAW' as const;
      },
    };
  }
  public actionClasses(): Set<Class<Action<string, any, any>>> {
    return new Set([
      UnoDealTopCardAction,
      UnoDrawCardAction,
      UnoEndTurnAction,
      UnoPickColorAction,
      UnoPlayCardAction,
      UnoShuffleAction,
      UnoPassTurnAction,
      UnoWinGameAction,
      UnoPutDiscardPileAction,
    ]);
  }

  protected entityClasses(): Set<EntityClass<Entity>> {
    return new Set([
      UnoCard, // abstract base; needed so the view-filter's $type:'UnoCard' resolves on the client
      UnoPlayer,
      UnoHand,
      UnoDefaultCard,
      ActionCard,
      UnoWildCard,
      UnoDeck,
      UnoDiscardPile,
      UnoMeta,
    ]);
  }
}
