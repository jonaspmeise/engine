export type GameState = Record<string, unknown>;

export type GameParameters = Record<string, unknown>;

export type Class<T> = abstract new (...args: any[]) => T;