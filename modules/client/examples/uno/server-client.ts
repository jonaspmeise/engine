/// <reference lib="dom" />
import { Uno } from '../../../library/tests/uno/uno';
import { UnoClient } from './uno-client';
import { MultiplayerSession } from '../../src/multiplayer-session';
import { promptLobbyId } from '../lobby-overlay';

const PLAYER_SIZE = 4;

const lobbyId = await promptLobbyId();

let client: UnoClient | null = null;
const session = new MultiplayerSession();

session
  .onSetup((playerIndex) => {
    client?.clear();
    const game = new Uno({ playerSize: PLAYER_SIZE });
    client = new UnoClient(game.players()[playerIndex]!, PLAYER_SIZE);
    client.onResultChoice = (result) => {
      client!.clear();
      result === 'restart' ? session.playAgain() : window.location.reload();
    };
  })
  .onState((s) => client?.feedSnapshots(s))
  .onChoices((choices, execute) =>
    client?.feedChoices(choices, (c) =>
      execute(typeof c === 'number' ? c : c.id),
    ),
  )
  .onGameOver(() => {});

session.connect(lobbyId);
