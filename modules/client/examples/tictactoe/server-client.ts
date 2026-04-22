/// <reference lib="dom" />
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { TicTacToeClient } from './tictactoe-client';
import { MultiplayerSession } from '../../src/multiplayer-session';
import { promptLobbyId } from '../lobby-overlay';

const lobbyId = await promptLobbyId();

let client: TicTacToeClient | null = null;
const session = new MultiplayerSession();

session
  .onSetup((playerIndex) => {
    client?.clear();
    const game = new TicTacToe({ firstPlayer: 'X' });
    client = new TicTacToeClient(game.players()[playerIndex]!);
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
