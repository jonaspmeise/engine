/**
 * STEARTHHONE — EVENTS AND TRIGGERS
 *
 * This file has been superseded by the card class lifecycle hook system.
 *
 * Card effects (Gurubashi Berserker, Harvest Golem, Fire Imp, Ragnaros) now
 * live in cards.ts as overrides of StoneCard lifecycle hooks:
 *   onSummon, onDestroy, onDraw, onDamageTaken, onEndOfTurn, onStartOfTurn
 *
 * Card effects that deal damage or summon tokens now push DealDamageAction /
 * SummonMinionAction onto gameState.triggerStack instead of calling helper
 * functions directly. This ensures every 'deal_damage' and 'summon_minion'
 * event is visible to the trigger system, regardless of source.
 *
 * System-level triggers (global auras, passive effects that aren't per-card)
 * can still use the Trigger<ACTION> interface from engine-v2.ts and be
 * returned from Stearthhone.triggers().
 */

export {}; // keep the file a valid module
