import { Action } from './action';
import { EnhancedChoice } from './choice';
import { Game } from '../game';
import {
  DEFAULT_LOGGER,
  Logger,
  NO_OP_LOGGER,
  PlayerInterfaceCallback,
} from '../game.types';
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

const _MCTS_CHUNK_SIZE = 25;

async function _runMctsAsync(
  game: Game<any>,
  selfPlayer: PlayerEntity,
  choices: EnhancedChoice<Action<string, any>>[],
  iterations: number,
  logger: Logger,
): Promise<EnhancedChoice<Action<string, any>>> {
  const root = _createNode(null);

  // Track time for all executions.
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    // Yield to the browser every chunk so paint/animation frames can run.
    if (i > 0 && i % _MCTS_CHUNK_SIZE === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    logger.debug(`MCTS iteration ${i + 1}/${iterations}...`);
    const simGame = game.clone({ logger: NO_OP_LOGGER });

    // Per-iteration mutable state captured by the callback closures.
    let currentNode = root;
    const path: _MctsNode[] = [root];
    let pastTree = false;

    const ourSimPlayer = simGame
      .players()
      .find((p) => p[entityId] === selfPlayer[entityId])!;

    simGame.registerPlayerCallback(ourSimPlayer, (_, simChoices, exec) => {
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

      exec(simChoices[Math.min(selectedIdx, simChoices.length - 1)]!);
    });

    // Register all opponents with a simple random-play callback.
    for (const opponent of simGame
      .players()
      .filter((p) => p !== ourSimPlayer)) {
      simGame.registerPlayerCallback(opponent, (_, simChoices, exec) => {
        if (simChoices.length > 0) {
          exec(simChoices[Math.floor(Math.random() * simChoices.length)]!);
        }
      });
    }

    // The game has now run synchronously to completion (or an end state).
    // Score the result from our player's perspective.
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

  return choices[Math.min(bestIdx, choices.length - 1)]!;
}

export namespace Players {
  // TODO: This file is growing. Refactor to different type somewhere else?
  export const chicken: (
    delay?: () => number,
    logger?: Logger,
    name?: string,
  ) => PlayerInterfaceCallback =
    (
      delay: () => number = () => 0,
      logger: Logger = DEFAULT_LOGGER,
      name?: string,
    ) =>
    (_, choices, execute) => {
      logger.debug(`Chicken player "${name}" has choices:`, choices);

      // This player does only take random choices...
      if (choices.length > 0) {
        setTimeout(() => {
          const choice = choices[Math.floor(Math.random() * choices.length)]!;
          execute(choice);
        }, delay());
      }
    };

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
  ) => PlayerInterfaceCallback =
    (game, player, iterations = 300, logger: Logger = NO_OP_LOGGER) =>
    (_, choices, execute) => {
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
    };
}
