import { Creatable } from './creatable';

export interface Creator<TYPE extends Creatable> {
  create(component: TYPE): TYPE;
}
