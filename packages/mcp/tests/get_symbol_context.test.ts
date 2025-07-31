import { Project } from "@ariadnejs/core";
import { getSymbolContext } from "../src/tools/get_symbol_context";
import * as path from "path";
import * as fs from "fs/promises";

describe("get_symbol_context", () => {
  let project: Project;
  
  beforeEach(() => {
    project = new Project();
  });
  
  describe("TypeScript symbol resolution", () => {
    it("should find a function definition by name", async () => {
      const code = `
export function processPayment(amount: number, customerId: string) {
  // Implementation
  return { success: true };
}

export function handleCheckout(order: any) {
  const result = processPayment(order.total, order.customerId);
  return result;
}
`;
      
      project.add_or_update_file("payment.ts", code);
      
      const result = await getSymbolContext(project, {
        symbol: "processPayment",
        searchScope: "project",
        includeTests: false
      });
      
      expect(result).not.toHaveProperty("error");
      if ("error" in result) return;
      
      expect(result.symbol.name).toBe("processPayment");
      expect(result.symbol.kind).toBe("function");
      expect(result.definition?.line).toBe(2);
      expect(result.definition?.implementation).toContain("export function processPayment");
      expect(result.usage.directReferences).toHaveLength(1);
      expect(result.usage.directReferences[0].line).toBe(8);
    });
    
    it("should find a class definition with methods", async () => {
      const code = `
export class PaymentService {
  constructor(private stripe: any) {}
  
  async processPayment(amount: number) {
    return this.stripe.charge(amount);
  }
  
  async refund(chargeId: string) {
    return this.stripe.refund(chargeId);
  }
}

const service = new PaymentService(stripeClient);
service.processPayment(100);
`;
      
      project.add_or_update_file("service.ts", code);
      
      const result = await getSymbolContext(project, {
        symbol: "PaymentService",
        searchScope: "project"
      });
      
      expect(result).not.toHaveProperty("error");
      if ("error" in result) return;
      
      expect(result.symbol.name).toBe("PaymentService");
      expect(result.symbol.kind).toBe("class");
      expect(result.definition?.line).toBe(2);
      expect(result.usage.directReferences).toHaveLength(1);
    });
    
    it("should handle symbol not found with suggestions", async () => {
      const code = `
export function processPayment() {}
export function processRefund() {}
export function handlePayment() {}
`;
      
      project.add_or_update_file("payment.ts", code);
      
      const result = await getSymbolContext(project, {
        symbol: "processPay",
        searchScope: "project"
      });
      
      expect(result).toHaveProperty("error", "symbol_not_found");
      if (!("error" in result)) return;
      
      expect(result.suggestions).toContain("processPayment");
      expect(result.suggestions).toContain("processRefund");
    });
    
    it("should track imports and cross-file references", async () => {
      // File 1: Definition
      const libCode = `
export function calculateFee(amount: number): number {
  return amount * 0.03;
}
`;
      project.add_or_update_file("lib/fees.ts", libCode);
      
      // File 2: Import and usage
      const serviceCode = `
import { calculateFee } from '../lib/fees';

export function processPayment(amount: number) {
  const fee = calculateFee(amount);
  return { amount, fee };
}
`;
      project.add_or_update_file("services/payment.ts", serviceCode);
      
      const result = await getSymbolContext(project, {
        symbol: "calculateFee",
        searchScope: "project"
      });
      
      expect(result).not.toHaveProperty("error");
      if ("error" in result) return;
      
      expect(result.definition?.file).toBe("lib/fees.ts");
      expect(result.usage.imports).toHaveLength(1);
      expect(result.usage.imports[0].file).toBe("services/payment.ts");
      expect(result.usage.directReferences.length).toBeGreaterThan(0);
    });
    
    it("should include test references when requested", async () => {
      const code = `
export function add(a: number, b: number): number {
  return a + b;
}
`;
      project.add_or_update_file("math.ts", code);
      
      const testCode = `
import { add } from './math';

describe('Math functions', () => {
  it('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
  
  test('handles negative numbers', () => {
    expect(add(-1, 1)).toBe(0);
  });
});
`;
      project.add_or_update_file("math.test.ts", testCode);
      
      const resultWithoutTests = await getSymbolContext(project, {
        symbol: "add",
        searchScope: "project",
        includeTests: false
      });
      
      expect(resultWithoutTests).not.toHaveProperty("error");
      if ("error" in resultWithoutTests) return;
      expect(resultWithoutTests.usage.tests).toHaveLength(0);
      
      const resultWithTests = await getSymbolContext(project, {
        symbol: "add",
        searchScope: "project",
        includeTests: true
      });
      
      expect(resultWithTests).not.toHaveProperty("error");
      if ("error" in resultWithTests) return;
      expect(resultWithTests.usage.tests).toHaveLength(2);
      expect(resultWithTests.usage.tests[0].testName).toBe("should add two numbers");
      expect(resultWithTests.usage.tests[1].testName).toBe("handles negative numbers");
    });
    
    it("should extract documentation from JSDoc comments", async () => {
      const code = `
/**
 * Calculates the payment fee for a transaction
 * @param amount The transaction amount
 * @param rate The fee rate as a decimal
 * @returns The calculated fee
 */
export function calculateFee(amount: number, rate: number = 0.03): number {
  return amount * rate;
}

/**
 * Processes a payment with validation
 */
@deprecated
export function processPayment(amount: number): boolean {
  const fee = calculateFee(amount);
  return fee > 0;
}
`;
      
      project.add_or_update_file("payment-service.ts", code);
      
      const result = await getSymbolContext(project, {
        symbol: "calculateFee",
        searchScope: "project"
      });
      
      expect(result).not.toHaveProperty("error");
      if ("error" in result) return;
      
      // Documentation extraction works!
      expect(result.definition?.documentation).toBeDefined();
      expect(result.definition?.documentation).toContain("Calculates the payment fee");
      expect(result.definition?.documentation).toContain("@param amount");
      expect(result.definition?.documentation).toContain("@returns");
      
      // Test decorator extraction
      const decoratedResult = await getSymbolContext(project, {
        symbol: "processPayment",
        searchScope: "project"
      });
      
      expect(decoratedResult).not.toHaveProperty("error");
      if ("error" in decoratedResult) return;
      
      // Annotation extraction works!
      expect(decoratedResult.definition?.annotations).toBeDefined();
      expect(decoratedResult.definition?.annotations).toContain("@deprecated");
      
      // Note: Some JSDoc comments may not be extracted depending on positioning
      // This is a core parser behavior, not a limitation of our implementation
    });

    it("should calculate basic metrics", async () => {
      const code = `
export function complexFunction(a: number, b: number): number {
  if (a > 0) {
    if (b > 0) {
      return a + b;
    } else {
      return a - b;
    }
  } else {
    if (b > 0) {
      return b - a;
    } else {
      return -(a + b);
    }
  }
}
`;
      
      project.add_or_update_file("complex.ts", code);
      
      const result = await getSymbolContext(project, {
        symbol: "complexFunction",
        searchScope: "project"
      });
      
      expect(result).not.toHaveProperty("error");
      if ("error" in result) return;
      
      // Metrics should use metadata.line_count when available (15 lines for this function)
      expect(result.metrics?.linesOfCode).toBe(15);
      
      // Verify full function body extraction (task-55 completed!)
      expect(result.definition?.implementation).toContain("complexFunction");
      expect(result.definition?.implementation).toContain("export function");
      expect(result.definition?.implementation).toContain("if (a > 0)");
      expect(result.definition?.implementation).toContain("return a + b");
      expect(result.definition?.implementation).toContain("return -(a + b)");
      
      // TODO: Add complexity calculation once available in core
    });

    it("should extract class inheritance relationships", async () => {
      const code = `
interface Animal {
  speak(): void;
}

interface Mammal extends Animal {
  furColor: string;
}

class Dog implements Mammal {
  furColor = "brown";
  
  speak() {
    console.log("Woof!");
  }
}

class Poodle extends Dog {
  breed = "poodle";
}
`;
      
      project.add_or_update_file("inheritance.ts", code);
      
      // Test parent class extraction
      const poodleResult = await getSymbolContext(project, {
        symbol: "Poodle",
        searchScope: "project"
      });
      
      expect(poodleResult).not.toHaveProperty("error");
      if ("error" in poodleResult) return;
      
      expect(poodleResult.relationships.extends).toBe("Dog");
      expect(poodleResult.relationships.dependents).toEqual([]); // No subclasses
      
      // Test interface implementation
      const dogResult = await getSymbolContext(project, {
        symbol: "Dog",
        searchScope: "project"
      });
      
      expect(dogResult).not.toHaveProperty("error");
      if ("error" in dogResult) return;
      
      expect(dogResult.relationships.implements).toEqual(["Mammal"]);
      expect(dogResult.relationships.dependents).toEqual(["Poodle"]); // Has one subclass
      
      // Test interface extension
      const mammalResult = await getSymbolContext(project, {
        symbol: "Mammal",
        searchScope: "project"
      });
      
      expect(mammalResult).not.toHaveProperty("error");
      if ("error" in mammalResult) return;
      
      expect(mammalResult.relationships.extends).toBe("Animal");
      expect(mammalResult.relationships.dependents).toEqual(["Dog"]); // One implementer
    });

    it("should extract Rust trait implementations", async () => {
      const rustCode = `
trait Display {
    fn fmt(&self) -> String;
}

struct Point {
    x: i32,
    y: i32,
}

impl Display for Point {
    fn fmt(&self) -> String {
        format!("({}, {})", self.x, self.y)
    }
}
`;
      
      project.add_or_update_file("display.rs", rustCode);
      
      const pointResult = await getSymbolContext(project, {
        symbol: "Point",
        searchScope: "project"
      });
      
      expect(pointResult).not.toHaveProperty("error");
      if ("error" in pointResult) return;
      
      expect(pointResult.symbol.kind).toBe("struct");
      expect(pointResult.relationships.implements).toEqual(["Display"]);
    });
  });
  
  describe("Performance", () => {
    it("should respond within 200ms for typical queries", async () => {
      // Load a moderately complex file
      const code = Array(50).fill(0).map((_, i) => `
export function func${i}(param: number): number {
  return param * ${i};
}
`).join('\n');
      
      project.add_or_update_file("large.ts", code);
      
      const start = Date.now();
      const result = await getSymbolContext(project, {
        symbol: "func25",
        searchScope: "project"
      });
      const duration = Date.now() - start;
      
      expect(result).not.toHaveProperty("error");
      expect(duration).toBeLessThan(200);
    });
  });
});