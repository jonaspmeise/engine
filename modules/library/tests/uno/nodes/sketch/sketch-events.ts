/**
 * SKETCH — UNO-specific GameEvents and typed triggers.
 *
 * This replaces card.onPlay() — card entities become pure data.
 * Side-effects (drawOverloads, direction, skip) are triggers.
 */

import { UnoCard } from '../../entities/card';
import { UnoMeta } from '../../entities/meta';
import { UnoPlayer } from '../../entities/player';
import { GameEvent, TypedTrigger } from './sketch-types';

// ---------------------------------------------------------------------------
// UNO-specific event types
// ---------------------------------------------------------------------------

export interface CardPlayedEvent extends GameEvent {
  readonly type: 'card_played';
  readonly card: UnoCard;
  readonly by: UnoPlayer;
}

export interface CardsDrawnEvent extends GameEvent {
  readonly type: 'cards_drawn';
  readonly player: UnoPlayer;
  readonly cards: UnoCard[];
}

export interface TurnEndedEvent extends GameEvent {
  readonly type: 'turn_ended';
  readonly player: UnoPlayer;
}

export type UnoGameEvent = CardPlayedEvent | CardsDrawnEvent | TurnEndedEvent;

// ---------------------------------------------------------------------------
// Card effect triggers (replaces card.onPlay() logic entirely)
//
// The card entity is now pure data (color, value, drawCards flag).
// All behavioural effects live here as independently-registered triggers.
// Adding a new card type = adding a new trigger — no entity subclass needed.
// ---------------------------------------------------------------------------

export const DrawTwoTrigger: TypedTrigger<CardPlayedEvent> = {
  name: 'draw-two-accumulates-forced-draw',
  on: ['card_played'],
  apply(runtime, { card }) {
    if (card.value !== 'draw-two' && card.value !== 'wild-draw-four') return;
    const drawCount = card.value === 'draw-two' ? 2 : 4;
    runtime.anyEntity(UnoMeta)!.drawOverloads += drawCount;
  },
};

export const ReverseTrigger: TypedTrigger<CardPlayedEvent> = {
  name: 'reverse-flips-direction',
  on: ['card_played'],
  apply(runtime, { card }) {
    if (card.value !== 'reverse') return;
    runtime.anyEntity(UnoMeta)!.direction *= -1;
  },
};

export const SkipTrigger: TypedTrigger<CardPlayedEvent> = {
  name: 'skip-advances-player-index',
  on: ['card_played'],
  apply(runtime, { card }) {
    if (card.value !== 'skip') return;
    const meta = runtime.anyEntity(UnoMeta)!;
    meta.currentPlayerIndex =
      (meta.currentPlayerIndex + meta.direction + meta.players.length) %
      meta.players.length;
  },
};

// ---------------------------------------------------------------------------
// How UnoPlayCardAction would emit events (pseudocode modification):
//
//   emits(result: void): CardPlayedEvent[] {
//     return [{ type: 'card_played', card: this.parameters.card, by: ... }];
//   }
//
// The engine calls action.emits() after doApply resolves and dispatches
// each event to all matching TypedTrigger.on subscriptions.
// ---------------------------------------------------------------------------
