/**
 * Class with different access modifiers
 * Tests: public, private, protected, readonly properties
 */

class Person {
  public name: string;
  private age: number;
  protected address: string;
  readonly id: number;

  constructor(name: string, age: number, address: string) {
    this.name = name;
    this.age = age;
    this.address = address;
    this.id = Date.now();
  }

  public get_age(): number {
    return this.age;
  }

  private increment_age(): void {
    this.age++;
  }

  protected get_address(): string {
    return this.address;
  }
}

export { Person };
