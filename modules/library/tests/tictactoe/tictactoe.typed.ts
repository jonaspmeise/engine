export type Mark = 'X' | 'O';

export type TicTacToeState = {
  readonly board: (Mark | null)[];
  readonly currentPlayer: Mark;
};

export type TicTacToeParameters = {
  readonly firstPlayer: Mark;
};
