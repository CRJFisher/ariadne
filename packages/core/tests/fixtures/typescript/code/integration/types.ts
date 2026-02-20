/**
 * Cross-module class methods - types.ts
 * Tests: exported class with methods for cross-module resolution
 */

export class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  get_name(): string {
    return this.name;
  }

  get_email(): string {
    return this.email;
  }

  update_name(new_name: string): void {
    this.name = new_name;
  }
}