import type { SingleplayerSession } from '@my-engine/client-singleplayer';
import { tick } from '@my-engine/client-singleplayer';

export type P2PSession = {
  readonly session: SingleplayerSession;
  readonly peerId: string;
};

export function createP2PSession(session: SingleplayerSession, peerId: string): P2PSession {
  return { session, peerId };
}

export function tickP2P(p2p: P2PSession): P2PSession {
  return { ...p2p, session: tick(p2p.session) };
}
