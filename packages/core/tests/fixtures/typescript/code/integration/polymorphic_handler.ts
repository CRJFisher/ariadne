/**
 * Interface with multiple implementations
 * Tests: polymorphic method resolution, interface method calls resolve to all implementations
 */

interface Handler {
  process(): void;
  get_name(): string;
}

class HandlerA implements Handler {
  process(): void {
    console.log("Handler A processing");
  }

  get_name(): string {
    return "Handler A";
  }
}

class HandlerB implements Handler {
  process(): void {
    console.log("Handler B processing");
  }

  get_name(): string {
    return "Handler B";
  }
}

class HandlerC implements Handler {
  process(): void {
    console.log("Handler C processing");
  }

  get_name(): string {
    return "Handler C";
  }
}

// Polymorphic function that calls interface method
function execute_handler(handler: Handler): void {
  // These calls should resolve to ALL three implementations
  handler.process();
  const name = handler.get_name();
  console.log(`Executed: ${name}`);
}

// Usage with concrete types
const a = new HandlerA();
const b = new HandlerB();
const c = new HandlerC();

execute_handler(a);
execute_handler(b);
execute_handler(c);

export { Handler, HandlerA, HandlerB, HandlerC, execute_handler };
