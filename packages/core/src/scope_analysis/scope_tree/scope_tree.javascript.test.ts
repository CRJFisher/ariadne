/**
 * Comprehensive JavaScript scope tree tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { build_scope_tree } from "./scope_tree";
import { FilePath } from "@ariadnejs/types";

describe("JavaScript Scope Tree Building", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript as any);
  });

  describe("Basic scope creation", () => {
    it("should create global scope for JavaScript files", () => {
      const code = `var x = 1;`;
      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      expect(scope_tree.root_id).toMatch(/^global:/);
      const root_node = scope_tree.nodes.get(scope_tree.root_id);
      expect(root_node).toBeDefined();
      expect(root_node?.type).toBe("global");
    });
  });

  describe("Function scopes", () => {
    it("should create scopes for function declarations", () => {
      const code = `
        function processData(input) {
          console.log(input);
        }

        function calculateTotal(items) {
          return items.length;
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);

      const names = function_scopes
        .map(scope => scope.name)
        .filter(name => name !== null)
        .sort();

      expect(names).toEqual(["calculateTotal", "processData"]);
    });

    it("should create scopes for function expressions", () => {
      const code = `
        const add = function(a, b) {
          return a + b;
        };

        const named = function namedFunc() {
          return "named";
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);

      // Named function expression should have a name
      const named_func = function_scopes.find(s => s.name === "namedFunc");
      expect(named_func).toBeDefined();
    });

    it("should create scopes for arrow functions", () => {
      const code = `
        const multiply = (a, b) => {
          return a * b;
        };

        const double = x => x * 2;

        const items = [1, 2, 3].map(item => {
          const doubled = item * 2;
          return doubled;
        });
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      // Should have arrow function scopes
      expect(function_scopes.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle IIFEs (Immediately Invoked Function Expressions)", () => {
      const code = `
        (function() {
          const privateVar = "private";
        })();

        (function named() {
          const anotherPrivate = "private";
        })();

        (() => {
          const arrowPrivate = "private";
        })();
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(3);
    });

    it("should handle async functions", () => {
      const code = `
        async function fetchData() {
          const result = await fetch('/api');
          return result;
        }

        const processAsync = async () => {
          await fetchData();
        };

        const obj = {
          async method() {
            return "async method";
          }
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      expect(function_scopes.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle generator functions", () => {
      const code = `
        function* generateSequence() {
          let i = 0;
          while (true) {
            yield i++;
          }
        }

        const genFunc = function* () {
          yield 1;
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);
      expect(function_scopes.find(s => s.name === "generateSequence")).toBeDefined();
    });
  });

  describe("Class scopes", () => {
    it("should create scopes for class declarations", () => {
      const code = `
        class UserManager {
          constructor() {
            this.users = [];
          }

          addUser(user) {
            this.users.push(user);
          }
        }

        class AdminManager extends UserManager {
          constructor() {
            super();
            this.permissions = [];
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(2);

      const names = class_scopes
        .map(scope => scope.name)
        .filter(name => name !== null)
        .sort();

      expect(names).toEqual(["AdminManager", "UserManager"]);
    });

    it("should create scopes for class methods", () => {
      const code = `
        class Calculator {
          add(a, b) {
            return a + b;
          }

          multiply(a, b) {
            return a * b;
          }

          static createDefault() {
            return new Calculator();
          }

          #privateMethod() {
            return "private";
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const method_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      expect(method_scopes.length).toBeGreaterThanOrEqual(4);
    });

    it("should handle anonymous classes", () => {
      const code = `
        const MyClass = class {
          method() {
            return "anonymous";
          }
        };

        export default class {
          process() {}
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(2);
    });

    it("should handle getters and setters", () => {
      const code = `
        class Person {
          constructor(name) {
            this._name = name;
          }

          get name() {
            return this._name;
          }

          set name(value) {
            this._name = value;
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const method_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      // Constructor, getter, and setter
      expect(method_scopes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Block scopes", () => {
    it("should create scopes for block statements", () => {
      const code = `
        function test() {
          {
            const blockScoped = 1;
          }

          if (true) {
            const ifScoped = 2;
          } else {
            const elseScoped = 3;
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const block_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "block"
      );

      expect(block_scopes.length).toBeGreaterThan(0);
    });

    it("should create scopes for loop blocks", () => {
      const code = `
        for (let i = 0; i < 10; i++) {
          const loopVar = i * 2;
        }

        for (const item of items) {
          console.log(item);
        }

        for (const key in object) {
          console.log(key);
        }

        while (condition) {
          const whileVar = true;
        }

        do {
          const doVar = true;
        } while (condition);
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const block_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "block"
      );

      expect(block_scopes.length).toBeGreaterThan(0);
    });

    it("should create scopes for try-catch-finally blocks", () => {
      const code = `
        try {
          const tryVar = "try";
          throw new Error();
        } catch (error) {
          const catchVar = "catch";
          console.log(error);
        } finally {
          const finallyVar = "finally";
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const block_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "block"
      );

      expect(block_scopes.length).toBeGreaterThanOrEqual(2);
    });

    it("should create scopes for switch cases", () => {
      const code = `
        switch (value) {
          case 1: {
            const caseVar1 = "one";
            break;
          }
          case 2: {
            const caseVar2 = "two";
            break;
          }
          default: {
            const defaultVar = "default";
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const block_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "block"
      );

      expect(block_scopes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Object methods", () => {
    it("should create scopes for object literal methods", () => {
      const code = `
        const obj = {
          method1() {
            return "method1";
          },
          method2: function() {
            return "method2";
          },
          arrow: () => {
            return "arrow";
          },
          async asyncMethod() {
            return "async";
          },
          *generatorMethod() {
            yield 1;
          }
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      // Object shorthand methods (method1, asyncMethod, generatorMethod) create method_definition nodes
      // Function expressions and arrow functions (method2, arrow) also create function scopes
      expect(function_scopes).toHaveLength(5);
    });

    it("should handle computed property names", () => {
      const code = `
        const key = "dynamic";
        const obj = {
          [key]() {
            return "computed";
          },
          ["literal" + "Key"]() {
            return "computed literal";
          }
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      expect(function_scopes).toHaveLength(2);
    });
  });

  describe("Nested scopes", () => {
    it("should handle deeply nested scopes", () => {
      const code = `
        function outer() {
          function inner() {
            const arrow = () => {
              {
                const deeplyNested = true;
              }
            };
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(5);
    });

    it("should correctly establish parent-child relationships", () => {
      const code = `
        function parent() {
          function child1() {}
          function child2() {}
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const parent_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "parent"
      );
      const child1_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "child1"
      );
      const child2_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "child2"
      );

      expect(parent_scope).toBeDefined();
      expect(child1_scope).toBeDefined();
      expect(child2_scope).toBeDefined();

      // The parent function should have a block child
      expect(parent_scope?.child_ids.length).toBeGreaterThan(0);

      // Get the block scope that's a child of parent
      const parentBlock = Array.from(scope_tree.nodes.values()).find(
        s => s.type === "block" && s.parent_id === parent_scope?.id
      );
      expect(parentBlock).toBeDefined();

      // Check that the block contains both child functions
      expect(parentBlock?.child_ids).toContain(child1_scope?.id);
      expect(parentBlock?.child_ids).toContain(child2_scope?.id);

      // Check that children point to the block (which is in the parent)
      expect(child1_scope?.parent_id).toBe(parentBlock?.id);
      expect(child2_scope?.parent_id).toBe(parentBlock?.id);
    });

    it("should handle closures", () => {
      const code = `
        function createCounter() {
          let count = 0;

          return function increment() {
            count++;
            return count;
          };
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const createCounter = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "createCounter"
      );
      const increment = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "increment"
      );

      expect(createCounter).toBeDefined();
      expect(increment).toBeDefined();

      // increment should be inside createCounter's block
      const counterBlock = Array.from(scope_tree.nodes.values()).find(
        s => s.type === "block" && s.parent_id === createCounter?.id
      );
      expect(counterBlock).toBeDefined();
      expect(counterBlock?.child_ids).toContain(increment?.id);
      expect(increment?.parent_id).toBe(counterBlock?.id);
    });
  });

  describe("Variable scoping patterns", () => {
    it("should not create scopes for var hoisting", () => {
      const code = `
        function test() {
          console.log(x); // undefined, not error
          var x = 5;
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      // var doesn't create block scope
      const function_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "test"
      );

      expect(function_scope).toBeDefined();
    });

    it("should handle with statements", () => {
      const code = `
        with (obj) {
          property = "value";
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      // with statement might or might not create a scope depending on query
      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty file", () => {
      const code = ``;
      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      expect(scope_tree.root_id).toBeDefined();
      expect(scope_tree.nodes.size).toBe(1);
    });

    it("should handle file with only comments", () => {
      const code = `
        // This is a comment
        /* Multi-line
           comment */
      `;
      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      expect(scope_tree.nodes.size).toBe(1);
    });

    it("should handle syntax errors gracefully", () => {
      const code = `
        function broken(
          // Missing closing parenthesis
        class AlsoBroken {
      `;
      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;

      expect(() => {
        build_scope_tree(tree.rootNode, file_path, "javascript");
      }).not.toThrow();
    });

    it("should handle very large files", () => {
      // Generate a large file with many functions
      const functions = [];
      for (let i = 0; i < 100; i++) {
        functions.push(`function func${i}() { return ${i}; }`);
      }
      const code = functions.join('\n');

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(100);
    });
  });

  describe("ES6+ features", () => {
    it("should handle destructuring in function parameters", () => {
      const code = `
        function process({ name, age }) {
          console.log(name, age);
        }

        const arrow = ([first, second]) => {
          return first + second;
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);
    });

    it("should handle rest parameters", () => {
      const code = `
        function sum(...numbers) {
          return numbers.reduce((a, b) => a + b, 0);
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      // sum and the arrow function in reduce
      expect(function_scopes).toHaveLength(2);
    });

    it("should handle template literals with embedded expressions", () => {
      const code = `
        const format = (name) => {
          return \`Hello, \${(() => name.toUpperCase())()}\`;
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      // format and the embedded arrow function
      expect(function_scopes).toHaveLength(2);
    });
  });
});