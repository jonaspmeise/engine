import { describe, test, expect, mock } from 'bun:test';
import { Game } from './game';
import { Action } from './action';

class TestGame extends Game<any> {
  public name = 'TestGame';

  initialize() {
    return {};
  }
  *enrichen() {
    return;
  }
  actions() {
    return new Set<Action<any, any>>();
  }
}

describe('game', () => {
  describe('setup', () => {
    test('calls initialize on game instantiation.', () => {
      // GIVEN when we instantiate an instance of our Testgame, initialize is called once.
      const initializeMock = mock(TestGame.prototype, 'initialize');

      // WHEN
      new TestGame();

      // THEN
      expect(initializeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('initialize', () => {
    test.todo(
      'issues a warning if a game, that is already initialized, is initialized again.',
    );
  });

  test.each([null, undefined, {}])(
    'throws an error if a game does not initialize a correct state object and instead returns %p.',
    (invalid: any) => {
      // GIVEN
      const initializeMock = mock(
        TestGame.prototype,
        'initialize',
        () => invalid,
      );

      // WHEN / THEN
      expect(() => new TestGame()).toThrowError(/invalid/g);
    },
  );
});
