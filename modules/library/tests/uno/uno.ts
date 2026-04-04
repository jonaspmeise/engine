import {
  Entity,
  PositiveRule,
  NegativeRule,
  Trigger,
  ViewFilter,
  EntityClass,
  Choice,
  QueryableRuntime,
} from '../../src';
import { Game } from '../../src/game';
import { UnoDeck } from './entities/deck';
import { UnoDefaultCard } from './entities/default-card';
import { UnoDiscardPile } from './entities/discard-pile';
import { UnoHand } from './entities/hand';
import { UnoMeta } from './entities/meta';
import { UnoPlayCardAction } from './actions/play-card';
import { UnoPlayer } from './entities/player';
import { UnoWildCard } from './entities/wild-card';
import { UnoEndTurn } from './actions/end-turn';
import { UnoDrawCardAction } from './actions/draw-card';
import { UnoOtherPlayerHandViewFilter } from './viewfilters/other-people-hand-viewfilter';
import { UnoWinGameAction } from './actions/win-game';

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

    return entities;
  }
  public name: string = 'Uno';

  positiveRules(): Set<PositiveRule> {
    return new Set([
      {
        name: 'current-player-can-play-card',
        apply: (runtime) => {
          const currentPlayer = runtime.anyEntity(UnoMeta)!.currentPlayer();
          const topCard = runtime
            .entities(UnoDiscardPile)[0]!
            .cards(runtime)[0];

          const playableCards = currentPlayer
            .hand(runtime)
            .cards(runtime)
            .filter(
              (card) => topCard === undefined || card.playableOn(topCard),
            );

          return playableCards.map(
            (card) =>
              new Choice(new UnoPlayCardAction({ card }), currentPlayer),
          );
        },
      },
      {
        name: 'current-player-can-skip-turn',
        apply: (runtime) => {
          const currentPlayer = runtime.anyEntity(UnoMeta)!.currentPlayer();

          return [new Choice(new UnoEndTurn(), currentPlayer)];
        },
      },
      {
        name: 'current-player-force-card-draw-overload',
        apply: (runtime) => {
          const meta = runtime.anyEntity(UnoMeta)!;

          if (meta.drawOverloads == 0) {
            return;
          }

          const currentPlayer = meta.currentPlayer();
          return [
            new Choice(
              new UnoDrawCardAction({
                amount: meta.drawOverloads,
                player: currentPlayer,
              }),
              currentPlayer,
            ),
          ];
        },
      },
    ]);
  }

  negativeRules(): Set<NegativeRule> | void {
    return new Set([
      {
        name: 'prevent-playing-when-forced-to-draw',
        apply: (choice, runtime) => {
          if (!(choice.execution instanceof UnoPlayCardAction)) {
            return;
          }

          const meta = runtime.anyEntity(UnoMeta)!;
          if (meta.drawOverloads > 0) {
            // You can only play a card that itself is a draw card!
            if (choice.execution.parameters.card.drawCards) {
              return false;
            } else {
              return true; // You must draw cards if you have to, you can't play a card instead!
            }
          }
        },
      },
    ]);
  }
  triggers(): Set<Trigger> | void {
    return new Set([
      {
        name: 'win-game-when-player-has-no-cards-left',
        apply: (runtime, lastChoice) => {
          if (
            lastChoice?.execution instanceof UnoPlayCardAction &&
            (lastChoice.player as UnoPlayer).hand(runtime).cards(runtime)
              .length === 0
          ) {
            return [
              new Choice(
                new UnoWinGameAction({
                  player: lastChoice.player as UnoPlayer,
                }),
                lastChoice.player as UnoPlayer,
              ),
            ];
          }
        },
      },
    ]);
  }
  viewFilters(runtime: QueryableRuntime): Set<ViewFilter> | void {
    return new Set(
      runtime
        .entities(UnoPlayer)
        .map((player) => new UnoOtherPlayerHandViewFilter(player)),
    );
  }
  protected entityClasses(): Set<EntityClass<Entity>> {
    return new Set([
      UnoPlayer,
      UnoHand,
      UnoDefaultCard,
      UnoWildCard,
      UnoDeck,
      UnoDiscardPile,
      UnoMeta,
    ]);
  }
}
