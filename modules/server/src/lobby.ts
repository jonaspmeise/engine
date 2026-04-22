import { generateLobbyId } from './words';
import type { WebSocketId } from './server.types';

export type LobbyId = string;

export type Lobby = {
  readonly id: LobbyId;
  readonly players: ReadonlyArray<WebSocketId>;
  /** Game-specific data submitted by each player when they created or joined the lobby. */
  readonly playerData: ReadonlyMap<WebSocketId, unknown>;
};

/**
 * Stateful store that tracks all active lobbies and their members.
 * All mutations happen in place; consumers hold a single shared instance.
 */
export class LobbyStore {
  private readonly _lobbies = new Map<LobbyId, Lobby>();

  /** Read-only view of all lobbies currently in the store. */
  get lobbies(): ReadonlyMap<LobbyId, Lobby> {
    return this._lobbies;
  }

  /**
   * Creates a new lobby with a collision-free {@link LobbyId} generated from
   * a random adjective-adjective-noun triplet, then returns the assigned id.
   *
   * @returns The id of the newly created lobby.
   */
  public createLobby(): LobbyId {
    let id: LobbyId;

    // Keep sampling until we find an id not already in use.
    do {
      id = generateLobbyId();
    } while (this._lobbies.has(id));

    this._lobbies.set(id, { id, players: [], playerData: new Map() });

    return id;
  }

  /**
   * Adds a player to an existing lobby, optionally associating game-specific
   * data (e.g. preferred symbol, custom deck) with that player.
   * Does nothing when the lobby does not exist.
   *
   * @param id       The id of the target lobby.
   * @param playerId The id of the player to add.
   * @param data     Optional game-specific data submitted by the player.
   */
  public joinLobby(id: LobbyId, playerId: WebSocketId, data?: unknown): void {
    const lobby = this._lobbies.get(id);

    if (lobby === undefined) {
      return;
    }

    const newPlayerData = new Map(lobby.playerData);
    newPlayerData.set(playerId, data);
    this._lobbies.set(id, {
      ...lobby,
      players: [...lobby.players, playerId],
      playerData: newPlayerData,
    });
  }

  /**
   * Removes a player from every lobby they are in.
   * Lobbies that become empty as a result are deleted from the store.
   *
   * @param playerId The id of the player to remove.
   */
  public leaveLobby(playerId: WebSocketId): void {
    for (const [id, lobby] of this._lobbies) {
      const remaining = lobby.players.filter((p) => p !== playerId);

      if (remaining.length === 0) {
        this._lobbies.delete(id);
      } else {
        this._lobbies.set(id, { ...lobby, players: remaining });
      }
    }
  }

  /**
   * Removes a lobby from the store by its id.
   * Does nothing when the lobby does not exist.
   *
   * @param id The id of the lobby to delete.
   */
  public deleteLobby(id: LobbyId): void {
    this._lobbies.delete(id);
  }
}
