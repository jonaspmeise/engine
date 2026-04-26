import { ModifiableRuntime } from '../../../src';
import { Graph } from '../../../src/components/graph/graph';
import { UnoDealTopCardAction } from '../actions/deal-top-card';
import { UnoDrawCardAction } from '../actions/draw-card';
import { UnoEndTurnAction } from '../actions/end-turn';
import { UnoPlayCardAction } from '../actions/play-card';
import { UnoDiscardPile } from '../entities/discard-pile';
import { UnoMeta } from '../entities/meta';
import { UnoPlayer } from '../entities/player';

export const passTurn = (runtime: ModifiableRuntime) => {
  const meta = runtime.anyEntity(UnoMeta)!;

  meta.currentPlayerIndex =
    (meta.currentPlayerIndex + meta.direction + meta.players.length) %
    meta.players.length;
};

export const checkWin = (runtime: ModifiableRuntime) => {
  const meta = runtime.anyEntity(UnoMeta)!;
  const currentPlayer = meta.currentPlayer();

  if (currentPlayer.hand(runtime).cards(runtime).length === 0) {
    runtime.end({
      winners: [currentPlayer],
      losers: meta.players.filter((p) => p !== currentPlayer),
      draws: [],
    });
  }
};

export const FatUnoGraph: Graph = {
  INITIAL: async (runtime) => {
    const meta = runtime.anyEntity(UnoMeta)!;
    const discardPile = runtime.anyEntity(UnoDiscardPile)!;

    for (const player of runtime.entities(UnoPlayer)) {
      new UnoDrawCardAction({ amount: 5, player }).apply(runtime);
    }

    new UnoDealTopCardAction().apply(runtime);

    while (runtime.status() !== 'ended') {
      // do nothing, just loop until the game is over
      const currentPlayer = meta.currentPlayer();

      // If there is a forced draw, you can either accept it or pass it.
      if (meta.drawOverloads > 0) {
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
            (
              await runtime.prompt(currentPlayer, [
                new UnoPlayCardAction({ card: drawnCard }),
                new UnoEndTurnAction(),
              ])
            ).apply(runtime);
          }
        }
      } else {
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
      }

      checkWin(runtime);
      passTurn(runtime);
    }
  },
};
