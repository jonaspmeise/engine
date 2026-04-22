import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from 'bun:test';
import { startServer } from './index';
import type { ConnectionData } from './server';

// Bundling the game client at startup can take a moment.
setDefaultTimeout(30_000);

describe('server (tictactoe)', () => {
  let server: Bun.Server<ConnectionData>;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    server = await startServer('tictactoe', { port: 0 });
    baseUrl = `http://${server.hostname}:${server.port}`;
    wsUrl = `ws://${server.hostname}:${server.port}/ws`;
  });

  afterAll(() => {
    server.stop(true);
  });

  describe('HTTP routes', () => {
    test('GET / returns main menu HTML with game name', async () => {
      // GIVEN a running tictactoe server
      // WHEN fetching the root route
      const res = await fetch(`${baseUrl}/`);

      // THEN it returns HTML containing the game name
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('Tic-Tac-Toe');
    });

    test('GET /play returns adapted singleplayer HTML', async () => {
      // GIVEN a running tictactoe server
      // WHEN fetching the singleplayer route
      const res = await fetch(`${baseUrl}/play`);

      // THEN it returns HTML with server-relative asset paths and the navigation override
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('/game.js');
      expect(html).not.toContain('./index.ts');
      expect(html).toContain("window.location.href = '/'");
    });

    test('GET /game.js returns JavaScript', async () => {
      // GIVEN a running tictactoe server
      // WHEN fetching the bundled game script
      const res = await fetch(`${baseUrl}/game.js`);

      // THEN it returns non-empty JavaScript
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/javascript');
      const js = await res.text();
      expect(js.length).toBeGreaterThan(0);
    });

    test('GET /game.css returns CSS (empty for tictactoe)', async () => {
      // GIVEN a running tictactoe server that has no external stylesheet
      // WHEN fetching the game stylesheet
      const res = await fetch(`${baseUrl}/game.css`);

      // THEN it still responds with a valid CSS content-type
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/css');
    });

    test('GET /menu.js returns JavaScript', async () => {
      // GIVEN a running tictactoe server
      // WHEN fetching the bundled menu script
      const res = await fetch(`${baseUrl}/menu.js`);

      // THEN it returns JavaScript
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/javascript');
    });

    test('GET /unknown returns 404', async () => {
      // GIVEN a running tictactoe server
      // WHEN requesting an unknown route
      const res = await fetch(`${baseUrl}/unknown`);

      // THEN it returns a 404
      expect(res.status).toBe(404);
    });
  });

  describe('WebSocket', () => {
    test('connects successfully', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a running tictactoe server
        // WHEN a client opens a WebSocket connection
        const ws = new WebSocket(wsUrl);

        // THEN the connection is established without error
        ws.onopen = () => {
          ws.close();
          resolve();
        };
        ws.onerror = () => reject(new Error('WebSocket error'));
      }));

    test('CREATE_LOBBY returns LOBBY_CREATED with adjective-adjective-noun id', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a connected client
        const ws = new WebSocket(wsUrl);

        // WHEN sending CREATE_LOBBY
        ws.onopen = () => ws.send(JSON.stringify({ type: 'CREATE_LOBBY' }));

        // THEN the server responds with LOBBY_CREATED and a valid slug id
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          expect(msg.type).toBe('LOBBY_CREATED');
          expect(typeof msg.payload.id).toBe('string');
          expect(msg.payload.id).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
          ws.close();
          resolve();
        };
        ws.onerror = () => reject(new Error('WebSocket error'));
      }));

    test('JOIN_LOBBY with unknown id returns ERROR', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a connected client
        const ws = new WebSocket(wsUrl);

        // WHEN sending JOIN_LOBBY for a lobby that does not exist
        ws.onopen = () =>
          ws.send(
            JSON.stringify({
              type: 'JOIN_LOBBY',
              payload: { id: 'nonexistent-lobby-id' },
            }),
          );

        // THEN the server responds with ERROR
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          expect(msg.type).toBe('ERROR');
          ws.close();
          resolve();
        };
        ws.onerror = () => reject(new Error('WebSocket error'));
      }));

    test('invalid JSON returns ERROR', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a connected client
        const ws = new WebSocket(wsUrl);

        // WHEN sending a non-JSON payload
        ws.onopen = () => ws.send('not-valid-json');

        // THEN the server responds with ERROR
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          expect(msg.type).toBe('ERROR');
          ws.close();
          resolve();
        };
        ws.onerror = () => reject(new Error('WebSocket error'));
      }));

    test('two clients can join the same lobby', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a host client that creates a lobby
        const host = new WebSocket(wsUrl);
        host.onopen = () => host.send(JSON.stringify({ type: 'CREATE_LOBBY' }));

        host.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type !== 'LOBBY_CREATED') return;
          const { payload } = msg;

          // WHEN a second client sends JOIN_LOBBY with the host's lobby id
          // (host stays connected so the lobby is not deleted before the joiner arrives)
          const joiner = new WebSocket(wsUrl);
          joiner.onopen = () =>
            joiner.send(
              JSON.stringify({
                type: 'JOIN_LOBBY',
                payload: { id: payload.id },
              }),
            );

          // THEN no ERROR is received within 200 ms
          const timer = setTimeout(() => {
            joiner.close();
            host.close();
            resolve();
          }, 200);

          joiner.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'ERROR') {
              clearTimeout(timer);
              joiner.close();
              host.close();
              reject(new Error(`Unexpected ERROR: ${msg.payload.message}`));
            }
          };

          joiner.onerror = () => {
            clearTimeout(timer);
            host.close();
            reject(new Error('WebSocket error'));
          };
        };

        host.onerror = () => reject(new Error('WebSocket error'));
      }));
  });

  describe('startServer', () => {
    test('rejects for unknown game names', async () => {
      // GIVEN an invalid game name
      // WHEN calling startServer
      // THEN it rejects with an error mentioning the unknown game
      await expect(startServer('unknown-game')).rejects.toThrow('Unknown game');
    });
  });

  // ── Multiplayer game sessions ─────────────────────────────────────────────

  describe('game session (tictactoe, 2 players)', () => {
    test('both players receive GAME_STARTED when the lobby fills', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN two clients waiting in a lobby
        let gameStartedCount = 0;

        function onGameStarted(): void {
          gameStartedCount++;
          if (gameStartedCount === 2) {
            // THEN both players are notified that the game has begun
            resolve();
          }
        }

        const p1 = new WebSocket(wsUrl);
        p1.onerror = () => reject(new Error('p1 error'));
        p1.onopen = () => p1.send(JSON.stringify({ type: 'CREATE_LOBBY' }));

        p1.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'GAME_STARTED') {
            onGameStarted();
            return;
          }
          if (msg.type !== 'LOBBY_CREATED') return;

          // WHEN the second player joins, filling the lobby
          const lobbyId: string = msg.payload.id;
          const p2 = new WebSocket(wsUrl);
          p2.onerror = () => reject(new Error('p2 error'));
          p2.onopen = () =>
            p2.send(
              JSON.stringify({ type: 'JOIN_LOBBY', payload: { id: lobbyId } }),
            );
          p2.onmessage = (ev2) => {
            const msg2 = JSON.parse(ev2.data as string);
            if (msg2.type === 'GAME_STARTED') onGameStarted();
            if (msg2.type === 'ERROR')
              reject(new Error(`p2 error: ${msg2.payload.message}`));
          };
        };
      }));

    test('both players receive an initial STATE message when the lobby fills', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a two-player lobby that fills as soon as both clients connect
        let statesReceived = 0;

        function onState(): void {
          statesReceived++;
          if (statesReceived === 2) {
            // Both players have received their state — game started successfully.
            resolve();
          }
        }

        const p1 = new WebSocket(wsUrl);
        p1.onerror = () => reject(new Error('p1 error'));
        p1.onopen = () => p1.send(JSON.stringify({ type: 'CREATE_LOBBY' }));

        p1.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'STATE') {
            onState();
            return;
          }
          if (msg.type !== 'LOBBY_CREATED') return;

          const lobbyId: string = msg.payload.id;
          const p2 = new WebSocket(wsUrl);
          p2.onerror = () => reject(new Error('p2 error'));
          p2.onopen = () =>
            p2.send(
              JSON.stringify({ type: 'JOIN_LOBBY', payload: { id: lobbyId } }),
            );
          p2.onmessage = (ev2) => {
            const msg2 = JSON.parse(ev2.data as string);
            if (msg2.type === 'STATE') onState();
            if (msg2.type === 'ERROR')
              reject(new Error(`p2 error: ${msg2.payload.message}`));
          };
        };
      }));

    test('at least one player receives CHOICES after game start', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a started two-player game
        // WHEN the first graph node is executed
        // THEN at least one player is prompted with CHOICES
        const p1 = new WebSocket(wsUrl);
        p1.onerror = () => reject(new Error('p1 error'));
        p1.onopen = () => p1.send(JSON.stringify({ type: 'CREATE_LOBBY' }));

        p1.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'CHOICES') {
            // THEN CHOICES contains at least one valid choice
            expect(Array.isArray(msg.payload.choices)).toBe(true);
            expect(msg.payload.choices.length).toBeGreaterThan(0);
            p1.close();
            resolve();
            return;
          }
          if (msg.type !== 'LOBBY_CREATED') return;

          const lobbyId: string = msg.payload.id;
          const p2 = new WebSocket(wsUrl);
          p2.onerror = () => reject(new Error('p2 error'));
          p2.onopen = () =>
            p2.send(
              JSON.stringify({ type: 'JOIN_LOBBY', payload: { id: lobbyId } }),
            );
          p2.onmessage = (ev2) => {
            const msg2 = JSON.parse(ev2.data as string);
            if (msg2.type === 'CHOICES') {
              expect(Array.isArray(msg2.payload.choices)).toBe(true);
              expect(msg2.payload.choices.length).toBeGreaterThan(0);
              p2.close();
              resolve();
            }
            if (msg2.type === 'ERROR')
              reject(new Error(`p2 error: ${msg2.payload.message}`));
          };
        };
      }));

    test('REQUEST_STATE returns ERROR when not in a session', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a client that has not joined any lobby
        const ws = new WebSocket(wsUrl);
        ws.onerror = () => reject(new Error('WebSocket error'));

        // WHEN sending REQUEST_STATE
        ws.onopen = () => ws.send(JSON.stringify({ type: 'REQUEST_STATE' }));

        // THEN the server responds with an error
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          expect(msg.type).toBe('ERROR');
          ws.close();
          resolve();
        };
      }));

    test('CHOICE returns ERROR when not in a session', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a client that has not joined any lobby
        const ws = new WebSocket(wsUrl);
        ws.onerror = () => reject(new Error('WebSocket error'));

        // WHEN sending CHOICE without an active game
        ws.onopen = () =>
          ws.send(JSON.stringify({ type: 'CHOICE', payload: { choiceId: 0 } }));

        // THEN the server responds with an error
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          expect(msg.type).toBe('ERROR');
          ws.close();
          resolve();
        };
      }));

    test('submitting a valid CHOICE advances the game and triggers another STATE', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a started two-player tictactoe game
        // WHEN the prompted player sends a valid CHOICE
        // THEN the server sends a STATE update to at least one player

        let stateAfterChoiceReceived = false;
        let choiceSent = false;

        function handleMsg(ws: WebSocket, raw: string): void {
          const msg = JSON.parse(raw);

          if (msg.type === 'ERROR') {
            reject(new Error(`Unexpected error: ${msg.payload.message}`));
            return;
          }

          if (msg.type === 'CHOICES' && !choiceSent) {
            choiceSent = true;

            // WHEN — submit the first available choice
            const firstChoice = msg.payload.choices[0];
            ws.send(
              JSON.stringify({
                type: 'CHOICE',
                payload: { choiceId: firstChoice.id },
              }),
            );
          }

          if (msg.type === 'STATE' && choiceSent && !stateAfterChoiceReceived) {
            stateAfterChoiceReceived = true;
            resolve();
          }
        }

        const p1 = new WebSocket(wsUrl);
        p1.onerror = () => reject(new Error('p1 error'));
        p1.onopen = () => p1.send(JSON.stringify({ type: 'CREATE_LOBBY' }));
        p1.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'LOBBY_CREATED') {
            const lobbyId: string = msg.payload.id;
            const p2 = new WebSocket(wsUrl);
            p2.onerror = () => reject(new Error('p2 error'));
            p2.onopen = () =>
              p2.send(
                JSON.stringify({
                  type: 'JOIN_LOBBY',
                  payload: { id: lobbyId },
                }),
              );
            p2.onmessage = (ev2) => handleMsg(p2, ev2.data as string);
          } else {
            handleMsg(p1, ev.data as string);
          }
        };
      }));
  });

  // ── Lobby and session cleanup ─────────────────────────────────────────────

  describe('lobby and session cleanup', () => {
    test('lobby is removed when the sole player disconnects before game starts', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN a lobby created by a single client
        const p1 = new WebSocket(wsUrl);
        p1.onerror = () => reject(new Error('p1 error'));
        p1.onopen = () => p1.send(JSON.stringify({ type: 'CREATE_LOBBY' }));

        p1.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          if (msg.type !== 'LOBBY_CREATED') return;
          const lobbyId: string = msg.payload.id;

          // WHEN the player disconnects
          p1.onclose = () => {
            // THEN a new client cannot join the now-deleted lobby
            const newClient = new WebSocket(wsUrl);
            newClient.onerror = () => reject(new Error('newClient error'));
            newClient.onopen = () =>
              newClient.send(
                JSON.stringify({
                  type: 'JOIN_LOBBY',
                  payload: { id: lobbyId },
                }),
              );
            newClient.onmessage = (ev2) => {
              const msg2 = JSON.parse(ev2.data as string);
              expect(msg2.type).toBe('ERROR');
              newClient.close();
              resolve();
            };
          };
          p1.close();
        };
      }));

    test('session is removed when all players disconnect from a running game', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN two players who have started a game
        let sessionKeyP1: string | undefined;
        let p1Closed = false;
        let p2Closed = false;

        function onBothClosed(): void {
          // WHEN both players have disconnected
          // THEN a RECONNECT with the stale session key is rejected
          const newClient = new WebSocket(wsUrl);
          newClient.onerror = () => reject(new Error('newClient error'));
          newClient.onopen = () =>
            newClient.send(
              JSON.stringify({
                type: 'RECONNECT',
                payload: { sessionKey: sessionKeyP1 },
              }),
            );
          newClient.onmessage = (ev) => {
            const msg = JSON.parse(ev.data as string);
            expect(msg.type).toBe('ERROR');
            newClient.close();
            resolve();
          };
        }

        const p1 = new WebSocket(wsUrl);
        p1.onerror = () => reject(new Error('p1 error'));
        p1.onopen = () => p1.send(JSON.stringify({ type: 'CREATE_LOBBY' }));

        p1.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'GAME_STARTED') {
            sessionKeyP1 = msg.payload.sessionKey as string;
            return;
          }
          if (msg.type !== 'LOBBY_CREATED') return;

          const lobbyId: string = msg.payload.id;
          const p2 = new WebSocket(wsUrl);
          p2.onerror = () => reject(new Error('p2 error'));
          p2.onopen = () =>
            p2.send(
              JSON.stringify({
                type: 'JOIN_LOBBY',
                payload: { id: lobbyId },
              }),
            );

          p2.onmessage = (ev2) => {
            const msg2 = JSON.parse(ev2.data as string);
            if (msg2.type !== 'GAME_STARTED') return;

            // WHEN both players close their connections after the game starts
            p1.onclose = () => {
              p1Closed = true;
              if (p1Closed && p2Closed) onBothClosed();
            };
            p2.onclose = () => {
              p2Closed = true;
              if (p1Closed && p2Closed) onBothClosed();
            };
            p1.close();
            p2.close();
          };
        };
      }));

    test('lobby and session are removed when the game ends', () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN two players who play a tictactoe game to completion
        let sessionKeyP1: string | undefined;
        let resolved = false;

        function handleMsg(ws: WebSocket, raw: string): void {
          const msg = JSON.parse(raw);
          if (msg.type === 'ERROR') {
            reject(new Error(`Unexpected error: ${msg.payload.message}`));
            return;
          }
          // WHEN each player always picks their first available choice
          if (msg.type === 'CHOICES') {
            ws.send(
              JSON.stringify({
                type: 'CHOICE',
                payload: { choiceId: msg.payload.choices[0].id },
              }),
            );
          }
          // WHEN the game ends
          if (msg.type === 'GAME_OVER' && !resolved) {
            resolved = true;
            // THEN a RECONNECT with the stale session key is rejected
            const newClient = new WebSocket(wsUrl);
            newClient.onerror = () => reject(new Error('newClient error'));
            newClient.onopen = () =>
              newClient.send(
                JSON.stringify({
                  type: 'RECONNECT',
                  payload: { sessionKey: sessionKeyP1 },
                }),
              );
            newClient.onmessage = (evNew) => {
              const msgNew = JSON.parse(evNew.data as string);
              expect(msgNew.type).toBe('ERROR');
              newClient.close();
              resolve();
            };
          }
        }

        const p1 = new WebSocket(wsUrl);
        p1.onerror = () => reject(new Error('p1 error'));
        p1.onopen = () => p1.send(JSON.stringify({ type: 'CREATE_LOBBY' }));

        p1.onmessage = (ev) => {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'GAME_STARTED') {
            sessionKeyP1 = msg.payload.sessionKey as string;
            return;
          }
          if (msg.type === 'LOBBY_CREATED') {
            const lobbyId: string = msg.payload.id;
            const p2 = new WebSocket(wsUrl);
            p2.onerror = () => reject(new Error('p2 error'));
            p2.onopen = () =>
              p2.send(
                JSON.stringify({
                  type: 'JOIN_LOBBY',
                  payload: { id: lobbyId },
                }),
              );
            p2.onmessage = (ev2) => handleMsg(p2, ev2.data as string);
            return;
          }
          handleMsg(p1, ev.data as string);
        };
      }));
  });
});
