import { createServer, type ConnectionData } from './server';
import type { GameServerConfig, ServerOptions } from './server.types';

export { GameServer } from './server';
export type { GameServerConfig, Server, ServerOptions } from './server.types';

/**
 * Starts the game server for the given {@link GameServerConfig}.
 * This is the shared entry point used by both the CLI and test code.
 */
export async function startServer(
  config: GameServerConfig<any>,
  options: ServerOptions = {},
): Promise<Bun.Server<ConnectionData>> {
  return createServer(config, options);
}

// ── CLI entry point ───────────────────────────────────────────────────────────


