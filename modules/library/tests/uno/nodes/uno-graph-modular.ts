import { Graph } from '../../../src/components/graph/graph';
import { UnoDealTopCardAction } from '../actions/deal-top-card';
import { UnoDrawCardAction } from '../actions/draw-card';
import { UnoEndTurnAction } from '../actions/end-turn';
import { UnoPlayCardAction } from '../actions/play-card';
import { UnoDiscardPile } from '../entities/discard-pile';
import { UnoMeta } from '../entities/meta';
import { UnoPlayer } from '../entities/player';

export const FatUnoGraph: Graph<
  | 'CHECK_FORCE_DRAW'
  | 'HANDLE_OVERDRAW'
  | 'TURN'
  | 'CHECK_WIN'
  | 'NEXT_PLAYER'
  | 'GAME_OVER'
> = {
  INITIAL: async (runtime) => {
    for (const player of runtime.entities(UnoPlayer)) {
      new UnoDrawCardAction({ amount: 5, player }).apply(runtime);
    }

    new UnoDealTopCardAction().apply(runtime);

    return 'TURN' as const;
  },
  CHECK_FORCE_DRAW: async (runtime) => {
    const meta = runtime.anyEntity(UnoMeta)!;
    return meta.drawOverloads > 0 ? 'HANDLE_OVERDRAW' : 'INITIAL';
  },
  HANDLE_OVERDRAW: async (runtime) => {
    const meta = runtime.anyEntity(UnoMeta)!;
    const currentPlayer = meta.currentPlayer();
    const discardPile = runtime.anyEntity(UnoDiscardPile)!;

    const possiblePassingCards = currentPlayer
      .hand(runtime)
      .cards(runtime)
      .filter((c) => c.drawCards ?? 0 > 0)
      .map((c) => new UnoPlayCardAction({ card: c }));

    const choice = await runtime.prompt(currentPlayer, [
      ...possiblePassingCards,
      new UnoDrawCardAction({
        amount: meta.drawOverloads,
        player: currentPlayer,
      }),
    ]);

    choice.apply(runtime);

    // If the drawn card is playable, you may play it immediately.
    if (choice instanceof UnoDrawCardAction) {
      const drawnCard = choice.returned()!.drawn[0]!;

      if (drawnCard.playableOn(discardPile.top(runtime)!)) {
        const choice = await runtime.prompt(currentPlayer, [
          new UnoPlayCardAction({ card: drawnCard }),
          new UnoEndTurnAction(),
        ]);

        if (choice instanceof UnoPlayCardAction) {
          choice.apply(runtime);
        } else {
          return 'NEXT_PLAYER';
        }
      } else {
        return 'NEXT_PLAYER';
      }
    }
    return 'CHECK_WIN';
  },
  TURN: async (runtime) => {
    const currentPlayer = runtime.anyEntity(UnoMeta)!.currentPlayer();
    const discardPile = runtime.anyEntity(UnoDiscardPile)!;

    const playableCardActions = currentPlayer
      .hand(runtime)
      .cards(runtime)
      .filter((c) => c.playableOn(discardPile.top(runtime)!))
      .map((c) => new UnoPlayCardAction({ card: c }));

    (
      await runtime.prompt(currentPlayer, [
        ...playableCardActions,
        new UnoDrawCardAction({ amount: 1, player: currentPlayer }),
      ])
    ).apply(runtime);

    return 'CHECK_WIN' as const;
  },
  CHECK_WIN: async (runtime) => {
    const meta = runtime.anyEntity(UnoMeta)!;
    const currentPlayer = meta.currentPlayer();

    if (currentPlayer.hand(runtime).cards(runtime).length === 0) {
      runtime.end({
        winners: [currentPlayer],
        losers: meta.players.filter((p) => p !== currentPlayer),
        draws: [],
      });

      return 'GAME_OVER';
    }

    return 'NEXT_PLAYER';
  },
  NEXT_PLAYER: async (runtime) => {
    new UnoEndTurnAction().apply(runtime);
  },
  GAME_OVER: async () => {},
};
