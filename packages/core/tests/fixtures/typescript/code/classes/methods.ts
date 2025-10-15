/**
 * Instance and static methods
 * Tests: instance methods, static methods, static properties
 */

class Calculator {
  static readonly VERSION = "1.0.0";
  private history: number[] = [];

  // Instance method
  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }

  // Instance method
  getHistory(): number[] {
    return this.history;
  }

  // Static method
  static multiply(a: number, b: number): number {
    return a * b;
  }

  // Static method
  static divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Division by zero");
    }
    return a / b;
  }
}

export { Calculator };
