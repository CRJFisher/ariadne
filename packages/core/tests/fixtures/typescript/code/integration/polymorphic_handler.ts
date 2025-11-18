/**
 * Interface with multiple implementations
 * Tests: polymorphic method resolution, interface method calls resolve to all implementations
 */

interface Handler {
  process(): void;
  getName(): string;
}

class HandlerA implements Handler {
  process(): void {
    console.log("Handler A processing");
  }

  getName(): string {
    return "Handler A";
  }
}

class HandlerB implements Handler {
  process(): void {
    console.log("Handler B processing");
  }

  getName(): string {
    return "Handler B";
  }
}

class HandlerC implements Handler {
  process(): void {
    console.log("Handler C processing");
  }

  getName(): string {
    return "Handler C";
  }
}

// Polymorphic function that calls interface method
function executeHandler(handler: Handler): void {
  // These calls should resolve to ALL three implementations
  handler.process();
  const name = handler.getName();
  console.log(`Executed: ${name}`);
}

// Usage with concrete types
const a = new HandlerA();
const b = new HandlerB();
const c = new HandlerC();

executeHandler(a);
executeHandler(b);
executeHandler(c);

export { Handler, HandlerA, HandlerB, HandlerC, executeHandler };
