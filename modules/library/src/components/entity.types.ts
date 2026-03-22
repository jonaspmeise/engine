export type EntityID = string;
export const dirty: unique symbol = Symbol('dirty');
export type Dirty = typeof dirty;
export const id: unique symbol = Symbol('id');
