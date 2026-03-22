import { Destroyable } from './destroyable';

export interface Destroyer<TYPE extends Destroyable> {
  destroy(component: TYPE): void;
}
