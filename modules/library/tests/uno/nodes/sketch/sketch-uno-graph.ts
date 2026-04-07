/**
 * SKETCH — UNO graph rewritten as a RichGraph with phase-scoped rules.
 *
 * Key differences from uno-graph-modular.ts:
 *
 *   1. No runtime.prompt() — no coroutines, no suspended async state.
 *      "Waiting for player input" = a ChoiceNode. The engine knows we are
 *      waiting, stores the current node ID in GamePhase, and resumes
 *      onChoice() when the player picks. Clone-safe at any point.
 *
 *   2. Rules are scoped to their node — TURN has can-play-card / can-draw-card.
 *      You never need to ask "but does this rule apply right now?" globally.
 *
 *   3. Card effects are triggers (sketch-events.ts), not card.onPlay().
 *      This graph has zero special-casing for draw-two / reverse / skip.
 *
 *   4. PLAY_OR_PASS_DRAWN carries the drawn card via UnoPhase (an entity).
 *      What used to be `const drawnCard = choice.returned()!.drawn[0]!`
 *      between two awaits now lives in serializable state.
 *
 * Trade-off that is honest to name: the linear UNO "draw → maybe play"
 * flow that was 8 lines in uno-graph-modular.ts is now two separate nodes
 * (ACCEPT_FORCED_DRAW + PLAY_OR_PASS_DRAWN). More code, but each node is
 * independently testable and the entire state is in entities at all times.
 */

import { Action } from '../../../../src/components/action';
import { ActionChoice } from '../../../../src/components/choice-action';
import { Entity } from '../../../../src/components/entity';
import { ModifiableRuntime } from '../../../../src/interfaces/modifiable-runtime';
import { UnoDealTopCardAction } from '../../actions/deal-top-card';
import { UnoDrawCardAction } from '../../actions/draw-card';
import { UnoEndTurnAction } from '../../actions/end-turn';
import { UnoPlayCardAction } from '../../actions/play-card';
import { UnoDiscardPile } from '../../entities/discard-pile';
import { UnoMeta } from '../../entities/meta';
import { UnoPlayer } from '../../entities/player';
import { GamePhase, RichGraph } from './sketch-types';

// ---------------------------------------------------------------------------
// UnoPhase: extends GamePhase with UNO-specific inter-node state.
// This replaces the "local variable" that previously lived between awaits.
// ---------------------------------------------------------------------------

class UnoPhase extends GamePhase {
  public $type = 'UnoPhase';
  // Written by ACCEPT_FORCED_DRAW, read by PLAY_OR_PASS_DRAWN.
  public drawnCard: import('../../entities/card').UnoCard | null = null;
}

// ---------------------------------------------------------------------------
// Helper: advance to next player (formerly UnoEndTurnAction logic in a node)
// ---------------------------------------------------------------------------

function advancePlayer(runtime: ModifiableRuntime): void {
  const meta = runtime.anyEntity(UnoMeta)!;
  meta.currentPlayerIndex =
    (meta.currentPlayerIndex + meta.direction + meta.players.length) %
    meta.players.length;
}

// ---------------------------------------------------------------------------
// The graph
// ---------------------------------------------------------------------------

export const UnoRichGraph: RichGraph = {
  // ── Setup ────────────────────────────────────────────────────────────────
  // Pure routing: deal cards, flip top card, go to TURN.
  // No player input needed.

  SETUP: {
    kind: 'routing',
    enter: async (runtime) => {
      for (const player of runtime.entities(UnoPlayer)) {
        await new UnoDrawCardAction({ amount: 5, player }).apply(runtime);
      }
      await new UnoDealTopCardAction().apply(runtime);
      return 'TURN';
    },
  },

  // ── TURN start ──────────────────────────────────────────────────────────
  // Branch: is there a forced draw? Otherwise let the player act.

  TURN: {
    kind: 'routing',
    enter: (runtime) => {
      const meta = runtime.anyEntity(UnoMeta)!;
      return meta.drawOverloads > 0 ? 'FORCED_DRAW' : 'PLAYER_ACTION';
    },
  },

  // ── Normal player turn ──────────────────────────────────────────────────
  // Choice node: play a card OR draw one.
  // Rules scoped here — no global rule needs to know "are we in PLAYER_ACTION?"

  PLAYER_ACTION: {
    kind: 'choice',
    choices: [
      {
        name: 'can-play-matching-card',
        apply: (runtime) => {
          const meta = runtime.anyEntity(UnoMeta)!;
          const currentPlayer = meta.currentPlayer();
          const top = runtime.anyEntity(UnoDiscardPile)!.top(runtime);
          if (!top) return;
          return currentPlayer
            .hand(runtime)
            .cards(runtime)
            .filter((c) => c.playableOn(top))
            .map(
              (c) =>
                new ActionChoice(
                  new UnoPlayCardAction({ card: c }),
                  currentPlayer,
                ),
            );
        },
      },
      {
        name: 'can-draw-one-card',
        apply: (runtime) => {
          const currentPlayer = runtime.anyEntity(UnoMeta)!.currentPlayer();
          return [
            new ActionChoice(
              new UnoDrawCardAction({ amount: 1, player: currentPlayer }),
              currentPlayer,
            ),
          ];
        },
      },
    ],
    onChoice: async (runtime, choice) => {
      await (choice.execution as Action<string, any>).apply(runtime);

      // If they drew (not played), check whether the drawn card is playable.
      if (choice.execution instanceof UnoDrawCardAction) {
        const drawn = choice.execution.returned()!.drawn[0];
        const top = runtime.anyEntity(UnoDiscardPile)!.top(runtime);

        if (drawn && top && drawn.playableOn(top)) {
          runtime.anyEntity(UnoPhase)!.drawnCard = drawn;
          return 'PLAY_OR_PASS_DRAWN';
        }
        // Can't play it — end the turn.
        return 'END_TURN';
      }

      return 'CHECK_WIN';
    },
  },

  // ── Play or pass the just-drawn card ────────────────────────────────────
  // The drawn card is carried in UnoPhase.drawnCard (entity state = cloneable).
  // Choice node: play the drawn card OR pass.

  PLAY_OR_PASS_DRAWN: {
    kind: 'choice',
    choices: [
      {
        name: 'can-play-drawn-card',
        apply: (runtime) => {
          const phase = runtime.anyEntity(UnoPhase)!;
          const currentPlayer = runtime.anyEntity(UnoMeta)!.currentPlayer();
          if (!phase.drawnCard) return;
          return [
            new ActionChoice(
              new UnoPlayCardAction({ card: phase.drawnCard }),
              currentPlayer,
            ),
          ];
        },
      },
      {
        name: 'can-pass-after-drawing',
        apply: (runtime) => {
          const currentPlayer = runtime.anyEntity(UnoMeta)!.currentPlayer();
          return [new ActionChoice(new UnoEndTurnAction(), currentPlayer)];
        },
      },
    ],
    onChoice: async (runtime, choice) => {
      runtime.anyEntity(UnoPhase)!.drawnCard = null; // consume carry state

      if (choice.execution instanceof UnoPlayCardAction) {
        await choice.execution.apply(runtime);
        return 'CHECK_WIN';
      }
      return 'END_TURN';
    },
  },

  // ── Forced-draw resolution ───────────────────────────────────────────────
  // Choice node: pass the stack with your own draw card OR accept the draws.

  FORCED_DRAW: {
    kind: 'choice',
    choices: [
      {
        name: 'can-stack-draw-card',
        apply: (runtime) => {
          const meta = runtime.anyEntity(UnoMeta)!;
          const currentPlayer = meta.currentPlayer();
          return currentPlayer
            .hand(runtime)
            .cards(runtime)
            .filter((c) => (c.drawCards ?? 0) > 0)
            .map(
              (c) =>
                new ActionChoice(
                  new UnoPlayCardAction({ card: c }),
                  currentPlayer,
                ),
            );
        },
      },
      {
        name: 'can-accept-forced-draw',
        apply: (runtime) => {
          const meta = runtime.anyEntity(UnoMeta)!;
          const currentPlayer = meta.currentPlayer();
          return [
            new ActionChoice(
              new UnoDrawCardAction({
                amount: meta.drawOverloads,
                player: currentPlayer,
              }),
              currentPlayer,
            ),
          ];
        },
      },
    ],
    onChoice: async (runtime, choice) => {
      await (choice.execution as Action<string, any>).apply(runtime);

      if (choice.execution instanceof UnoDrawCardAction) {
        // Reset the overload after acceptance.
        runtime.anyEntity(UnoMeta)!.drawOverloads = 0;
        // The drawn cards can't be played immediately in this variant.
        return 'END_TURN';
      }

      // Stacked a draw card — effects fire via triggers (DrawTwoTrigger etc.)
      return 'CHECK_WIN';
    },
  },

  // ── Win check ────────────────────────────────────────────────────────────

  CHECK_WIN: {
    kind: 'routing',
    enter: (runtime) => {
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

      return 'END_TURN';
    },
  },

  // ── End current player's turn ────────────────────────────────────────────

  END_TURN: {
    kind: 'routing',
    enter: (runtime) => {
      advancePlayer(runtime);
      return 'TURN';
    },
  },

  GAME_OVER: {
    kind: 'routing',
    enter: () => {
      /* terminal */
    },
  },
};
