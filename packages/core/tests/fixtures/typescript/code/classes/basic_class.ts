/**
 * Basic class example for testing
 */

export class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  greet(): string {
    return `Hello, ${this.name}`;
  }
}
