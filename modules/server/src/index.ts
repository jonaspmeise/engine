import { createServer, type ConnectionData } from './server';
import { tictactoeConfig } from './games/tictactoe';
import { unoConfig } from './games/uno';
import type { ServerGameConfig, ServerOptions } from './server.types';

const GAMES: Readonly<Record<string, ServerGameConfig>> = {
  tictactoe: tictactoeConfig,
  uno: unoConfig,
};

/**
 * Starts the game server for the given game slug.
 * This is the shared entry point used by both the CLI and test code.
 */
export async function startServer(
  gameName: string,
  options: ServerOptions = {},
): Promise<Bun.Server<ConnectionData>> {
  const game = GAMES[gameName];
  if (game === undefined) {
    throw new Error(
      `Unknown game: "${gameName}". Available: ${Object.keys(GAMES).join(', ')}.`,
    );
  }
  return createServer(game, options);
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (import.meta.main) {
  const gameName = process.argv[2];

  if (gameName === undefined) {
    console.error('Usage: bun src/index.ts <game>');
    console.error(`Available games: ${Object.keys(GAMES).join(', ')}`);
    process.exit(1);
  }

  const server = await startServer(gameName);
  console.info(
    `[server] http://${server.hostname}:${server.port}  (${GAMES[gameName]?.name ?? gameName})`,
  );
}
