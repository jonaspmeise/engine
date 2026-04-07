import { ActionChoice } from '../../../src/components/choice-action';
import { DefaultChoice } from '../../../src/components/choice-default';
import { Graph } from '../../../src/components/graph/graph';
import { UnoDrawCardAction } from '../actions/draw-card';
import { UnoPlayCardAction } from '../actions/play-card';
import { UnoWinGameAction } from '../actions/win-game';
import { UnoCard } from '../entities/card';
import { UnoDiscardPile } from '../entities/discard-pile';
import { UnoMeta } from '../entities/meta';
import { UnoPlayer } from '../entities/player';
import { UnoWildCard } from '../entities/wild-card';
import { UnoDefaultColors } from '../uno';

export const UnoGraph: Graph = {
  /**
   * 1. START_TURN
   * Checks if the player is under the effect of a "Forced Draw" (+2/+4).
   */
  START_TURN: (runtime) => {
    return runtime.anyEntity(UnoMeta)!.drawOverloads > 0
      ? 'RESOLVE_PENALTY'
      : 'PLAYER_ACTION';
  },

  /**
   * 2. RESOLVE_PENALTY
   * The player must either stack another draw card (if rules allow) or draw the stack.
   */
  RESOLVE_PENALTY: async (runtime) => {
    const meta = runtime.anyEntity(UnoMeta)!;
    const player = meta.currentPlayer();
    const topCard = runtime.anyEntity(UnoDiscardPile)!.top(runtime)!;

    // Can the player "Stack" a +2 on a +2 or a +4 on a +4?
    // TODO: There is a lot of repetitive queries here, that maybe should be cached with decorators...
    const counterCards = player
      .hand(runtime)
      .cards(runtime)
      .filter((c) => c.value === topCard.value);

    if (counterCards.length > 0) {
      const choice: UnoPlayCardAction = await runtime.prompt(
        player,
        counterCards.map(
          (card) => new ActionChoice(new UnoPlayCardAction({ card }), player),
        ),
      );

      // TODO: Alternatively: runtime.execute(choice), or do we schedule this choice...?
      choice.apply(runtime);
    } else {
      // Force draw the penalty
      new UnoDrawCardAction({ amount: meta.drawOverloads, player }).apply(
        runtime,
      );
    }
    return 'NEXT_PLAYER';
  },
  PLAYER_ACTION: async (runtime) => {
    const player = runtime.anyEntity(UnoMeta)!.currentPlayer();
    const topCard = runtime.anyEntity(UnoDiscardPile)!.top(runtime);

    const playableChoices = player
      .hand(runtime)
      .cards(runtime)
      .filter((card) => card.playableOn(topCard))
      .map((card) => new ActionChoice(new UnoPlayCardAction({ card }), player));

    let played: UnoCard;
    if (playableChoices.length == 0) {
      // Force a draw - instead of automatically executing this, we present this as a choice to the player.
      // That way, the player better understands what is happening.
      // TODO: Should we just automatically execute this? Will reduce boilerplate!
      const choice = await runtime.prompt(
        player,
        [
          new ActionChoice(
            new UnoDrawCardAction({ amount: 1, player }),
            player,
          ),
        ],
        'You have no playable cards, you must draw a card.',
      );

      // Re-check, whether this card is playable.
      // TODO: Type this better, because once we prompted, this is definitely not undefined anymore!
      const drawnCard = choice.returned()!.drawn[0]!;
      if (drawnCard.playableOn(topCard)) {
        (
          await runtime.prompt(player, [
            new ActionChoice(
              new UnoPlayCardAction({ card: drawnCard }),
              player,
            ),
          ])
        ).apply(runtime);
        played = drawnCard;
      } else {
        // Nothing playable, go to next player.
        return 'NEXT_PLAYER';
      }
    } else {
      const choice = await runtime.prompt(player, playableChoices);
      choice.apply(runtime);
      played = choice.parameters.card;
    }

    // TODO: Resolve effect of the card here!
    return 'APPLY_CARD_EFFECT';
  },
  APPLY_CARD_EFFECT: (runtime) => {
    const card = runtime.anyEntity(UnoDiscardPile)!.top(runtime)!;
    const meta = runtime.anyEntity(UnoMeta)!;

    switch (card.value) {
      case 'reverse': {
        meta.direction *= -1;
        break;
      }
      case 'skip': {
        meta.currentPlayerIndex =
          (meta.currentPlayerIndex + meta.direction + runtime.players.length) %
          runtime.players.length;
        break;
      }
      case 'draw-two': {
        meta.drawOverloads += 2;
        break;
      }
      case 'wild-draw-four': {
        meta.drawOverloads += 4;
      }
      case 'wild': {
        // TODO: Implement!
        runtime.schedule('WILD_COLOR_PICK');
      }
    }

    return 'CHECK_WIN';
  },
  WILD_COLOR_PICK: async (runtime) => {
    const player = runtime.anyEntity(UnoMeta)!.currentPlayer();
    // TODO: Should check, whether this is actually a wild card...?
    const card = runtime
      .anyEntity(UnoDiscardPile)!
      .top(runtime)! as UnoWildCard;

    const choice = await runtime.prompt(
      player,
      UnoDefaultColors.map((color) => new DefaultChoice(color)),
      'Pick a color for the wild card.',
    );

    card.color = choice;

    return 'CHECK_WIN';
  },
  CHECK_WIN: (runtime) => {
    const playerWithoutCards = runtime
      .entities(UnoPlayer)
      .find((p) => p.hand(runtime).cards(runtime).length === 0);

    if (playerWithoutCards !== undefined) {
      new UnoWinGameAction({
        player: playerWithoutCards,
      }).apply(runtime);
    } else {
      return 'NEXT_PLAYER';
    }
  },

  NEXT_PLAYER: (runtime) => {
    const meta = runtime.anyEntity(UnoMeta)!;
    meta.currentPlayerIndex =
      (meta.currentPlayerIndex + meta.direction + runtime.players.length) %
      runtime.players.length;
    return 'START_TURN';
  },
};
