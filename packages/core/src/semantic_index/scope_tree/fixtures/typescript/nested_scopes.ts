/**
 * Complex TypeScript file with nested scopes for testing
 */

// Module scope - root level
const MODULE_CONSTANT = "test";

// Class scope
export class OuterClass {
  private field: string = "value";

  // Constructor scope
  constructor(param: string) {
    this.field = param;

    // Block scope within constructor
    if (param) {
      const localVar = "local";
      console.log(localVar);
    }
  }

  // Method scope
  public async processData(items: string[]): Promise<void> {
    // Block scope - for loop
    for (const item of items) {
      // Block scope - if statement
      if (item.length > 0) {
        const processed = item.toUpperCase();

        // Block scope - try-catch
        try {
          await this.handleItem(processed);
        } catch (error) {
          console.error("Error:", error);

          // Block scope - nested if
          if (error instanceof Error) {
            throw new Error(`Failed to process: ${error.message}`);
          }
        }
      }
    }
  }

  // Private method scope
  private handleItem(item: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Arrow function scope
      setTimeout(() => {
        // Block scope within arrow function
        if (Math.random() > 0.5) {
          resolve();
        } else {
          reject(new Error("Random failure"));
        }
      }, 100);
    });
  }

  // Static method scope
  static createDefault(): OuterClass {
    return new OuterClass("default");
  }
}

// Function scope at module level
function moduleFunction(param: number): string {
  // Block scope - switch
  switch (param) {
    case 1: {
      // Block scope within case
      const result = "one";
      return result;
    }
    case 2: {
      const result = "two";
      return result;
    }
    default: {
      const result = param.toString();
      return result;
    }
  }
}

// Interface scope
export interface DataProcessor {
  process(data: any): Promise<void>;
}

// Nested class
export class InnerProcessor implements DataProcessor {
  // Method scope in nested class
  async process(data: any): Promise<void> {
    // Block scope - while loop
    let counter = 0;
    while (counter < 10) {
      // Block scope within while
      if (counter % 2 === 0) {
        await this.processEven(counter);
      } else {
        await this.processOdd(counter);
      }
      counter++;
    }
  }

  private async processEven(num: number): Promise<void> {
    // Function scope
    const helper = (x: number) => x * 2;
    console.log(helper(num));
  }

  private async processOdd(num: number): Promise<void> {
    const helper = (x: number) => x * 3;
    console.log(helper(num));
  }
}

// Namespace scope
export namespace Utils {
  export function format(value: string): string {
    return value.trim().toLowerCase();
  }

  export class Helper {
    static normalize(input: string): string {
      return input.replace(/\s+/g, " ");
    }
  }
}