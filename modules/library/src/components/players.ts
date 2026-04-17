import { Action } from './action';
import { EnhancedChoice } from './choice';
import { Game } from '../game/game';
import {
  DEFAULT_LOGGER,
  Logger,
  NO_OP_LOGGER,
  PlayerInterfaceCallback,
} from '../game/game.types';
import { PlayerEntity } from '../services/entity/entity-service.types';
import { entityId } from '@my-engine/library';

interface _MctsNode {
  visits: number;
  wins: number;
  children: Map<number, _MctsNode>; // Mapping of choice index to child node
  parent: _MctsNode | null;
}

function _createNode(parent: _MctsNode | null): _MctsNode {
  return { visits: 0, wins: 0, children: new Map(), parent };
}

const _UCB1_C = Math.SQRT2;

function _ucb1SelectIndex(node: _MctsNode, numChoices: number): number {
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < numChoices; i++) {
    const child = node.children.get(i);
    if (child === undefined || child.visits === 0) {
      return i; // unvisited => infinite score, explore immediately
    }
    const score =
      child.wins / child.visits +
      _UCB1_C * Math.sqrt(Math.log(node.visits) / child.visits);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Yield to the browser at most once per frame (~16ms) so paint/input events can run
// without imposing a fixed per-iteration overhead.
const _MCTS_YIELD_INTERVAL_MS = 16;

async function _runMctsAsync(
  game: Game<any>,
  selfPlayer: PlayerEntity,
  choices: EnhancedChoice<Action<string, any>>[],
  iterations: number,
  logger: Logger,
): Promise<EnhancedChoice<Action<string, any>>> {
  const root = _createNode(null);

  const start = performance.now();
  let lastYield = start;

  for (let i = 0; i < iterations; i++) {
    // Yield to the browser periodically (time-based) so paint/animation frames can run.
    // Using time-based rather than iteration-based prevents unnecessary yields for fast
    // simulations and avoids the ~4ms minimum setTimeout penalty on every chunk boundary.
    const now = performance.now();
    if (now - lastYield >= _MCTS_YIELD_INTERVAL_MS) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      lastYield = performance.now();
    }

    const simGame = game.clone({ logger: NO_OP_LOGGER });

    // Per-iteration mutable state captured by the callback closures.
    let currentNode = root;
    const path: _MctsNode[] = [root];
    let pastTree = false;

    const ourSimPlayer = simGame
      .players()
      .find((p) => p[entityId] === selfPlayer[entityId])!;

    // Register all opponents first — the game will not start until every player
    // has a handler, so these registrations are non-starting and need not be awaited.
    for (const opponent of simGame
      .players()
      .filter((p) => p !== ourSimPlayer)) {
      simGame.registerPlayerCallback(opponent, {
        state: () => {},
        prompt: (simChoices, execute) => {
          if (simChoices.length > 0) {
            execute(simChoices[Math.floor(Math.random() * simChoices.length)]!);
          }
        },
      });
    }

    // Register the MCTS player last and await — this triggers _start() and runs
    // the game to full completion before the next line executes.
    await simGame.registerPlayerCallback(ourSimPlayer, {
      state: () => {},
      prompt: (simChoices, execute) => {
        if (simChoices.length === 0) return;

        let selectedIdx: number;

        if (!pastTree) {
          // Find the first choice index that has never been expanded at this node.
          let unvisitedIdx: number | undefined;
          for (let j = 0; j < simChoices.length; j++) {
            const child = currentNode.children.get(j);
            if (child === undefined || child.visits === 0) {
              unvisitedIdx = j;
              break;
            }
          }

          if (unvisitedIdx !== undefined) {
            // Expansion: create a child node and switch to random play.
            selectedIdx = unvisitedIdx;
            if (!currentNode.children.has(selectedIdx)) {
              currentNode.children.set(selectedIdx, _createNode(currentNode));
            }
            currentNode = currentNode.children.get(selectedIdx)!;
            path.push(currentNode);
            pastTree = true;
          } else {
            // All children visited: selection via UCB1.
            selectedIdx = _ucb1SelectIndex(currentNode, simChoices.length);
            currentNode = currentNode.children.get(selectedIdx)!;
            path.push(currentNode);
          }
        } else {
          // Simulation phase: play uniformly at random.
          selectedIdx = Math.floor(Math.random() * simChoices.length);
        }

        execute(simChoices[Math.min(selectedIdx, simChoices.length - 1)]!);
      },
    });

    // The game has now run to completion — score from our player's perspective.
    const endStatus = simGame.endStatus();
    const won = endStatus?.winners.some((w) => w === ourSimPlayer) ?? false;
    const drew = !won && (endStatus?.draws.length ?? 0) > 0;
    const score = won ? 1 : drew ? 0.5 : 0;

    // Backpropagate the result up through every node on the path.
    for (const node of path) {
      node.visits++;
      node.wins += score;
    }
  }

  // Robust best-move selection: pick the most-visited child of the root.
  let bestIdx = 0;
  let bestVisits = -1;
  for (const [idx, child] of root.children) {
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      bestIdx = idx;
    }
  }

  // Show time it took.
  const end = performance.now();
  const iterationsPerSecond = (iterations / ((end - start) / 1000)).toFixed(2);
  logger.info(
    `MCTS completed ${iterations} iterations in ${(end - start).toFixed(2)} ms (${iterationsPerSecond} iterations per second).`,
  );

  // Debug log: show visit count and win-rate for every root child.
  const ratings = new Map<string, string>();
  for (const [idx, child] of root.children) {
    const choice = choices[idx];
    if (choice !== undefined) {
      ratings.set(
        `${choice.execution.$type} @ ${JSON.stringify(choice.execution.parameters)}`,
        `Win rate: ${(child.wins / child.visits).toFixed(5)} #${child.visits}`,
      );
    }
  }
  logger.debug(`MCTS ratings:`, ratings);

  return choices[Math.min(bestIdx, choices.length - 1)]!;
}

export namespace Players {
  // TODO: This file is growing. Refactor to different type somewhere else?
  export const chicken: (
    delay?: () => number,
    logger?: Logger,
    name?: string,
  ) => PlayerInterfaceCallback = (
    delay: () => number = () => 0,
    logger: Logger = DEFAULT_LOGGER,
    name?: string,
  ) => ({
    // Chicken no need state!
    state: () => {},
    prompt: (choices, execute) => {
      // This player does only take random choices...
      if (choices.length > 0) {
        setTimeout(() => {
          const choice = choices[Math.floor(Math.random() * choices.length)]!;
          execute(choice);
        }, delay());
      }
    },
  });

  /**
   * A player that uses the UCT variant of Monte Carlo Tree Search (MCTS) to pick
   * the statistically best available choice.
   *
   * For each turn the player:
   *  1. Clones the live game state `iterations` times.
   *  2. Builds a UCB1-guided search tree over the clones using synchronous random
   *     playouts for opponent moves and the simulation phase.
   *  3. Returns the move with the highest visit count (robust best-move selection).
   *
   * @param game    The live game instance to clone simulations from.
   * @param player  The player entity this MCTS acts on behalf of.
   * @param iterations  Number of MCTS iterations per decision (default 300).
   */
  export const mcts: (
    game: Game<any>,
    player: PlayerEntity,
    iterations?: number,
    logger?: Logger,
  ) => PlayerInterfaceCallback = (
    game,
    player,
    iterations = 300,
    logger: Logger = NO_OP_LOGGER,
  ) => ({
    state: () => {},
    prompt: (choices, execute) => {
      if (choices.length === 0) return;
      if (choices.length === 1) {
        execute(choices[0]!);
        return;
      }

      // Run asynchronously so the browser can paint between MCTS chunks.
      setTimeout(async () => {
        const best = await _runMctsAsync(
          game,
          player,
          choices as EnhancedChoice<Action<string, any>>[],
          iterations,
          logger,
        );
        execute(best);
      }, 0);
    },
  });
}
