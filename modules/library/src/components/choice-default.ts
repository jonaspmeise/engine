import { Choice } from './choice';

export class DefaultChoice<CHOICES extends string> extends Choice<CHOICES> {
  constructor(public readonly choices: CHOICES) {
    super();
  }
}
