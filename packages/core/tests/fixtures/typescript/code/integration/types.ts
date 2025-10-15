/**
 * Cross-module class methods - types.ts
 * Tests: exported class with methods for cross-module resolution
 */

export class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  getName(): string {
    return this.name;
  }

  getEmail(): string {
    return this.email;
  }

  updateName(newName: string): void {
    this.name = newName;
  }
}