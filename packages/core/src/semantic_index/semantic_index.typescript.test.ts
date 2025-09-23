/**
 * Comprehensive TypeScript semantic index tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_semantic_index, query_tree_and_parse_captures } from "./semantic_index";
import { SemanticEntity, SemanticCategory } from "./capture_types";

const FIXTURES_DIR = join(__dirname, "fixtures", "typescript");

describe("Semantic Index - TypeScript Comprehensive", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.tsx);
  });

  describe("query_tree_and_parse_captures functionality", () => {
    it("should capture all TypeScript elements correctly", () => {
      const code = `
        interface User {
          id: number;
          name: string;
        }

        class UserImpl implements User {
          constructor(public id: number, public name: string) {}

          @method
          getName(): string {
            return this.name;
          }
        }

        export type { User };
        export { UserImpl };
      `;

      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures(
        "typescript" as Language,
        tree,
        "test.ts" as FilePath
      );

      // Verify we have captures from all categories
      const categories = new Set(captures.scopes.map(c => c.category));
      expect(categories.has(SemanticCategory.SCOPE)).toBe(true);

      const entities = new Set([
        ...captures.definitions.map(c => c.entity),
        ...captures.references.map(c => c.entity),
        ...captures.exports.map(c => c.entity)
      ]);

      expect(entities.has(SemanticEntity.INTERFACE)).toBe(true);
      expect(entities.has(SemanticEntity.CLASS)).toBe(true);
      expect(entities.has(SemanticEntity.METHOD)).toBe(true);
      expect(entities.has(SemanticEntity.CONSTRUCTOR)).toBe(true);

      // Check that we have the expected number of captures
      expect(captures.scopes.length).toBeGreaterThan(0);
      expect(captures.definitions.length).toBeGreaterThan(0);
      expect(captures.exports.length).toBeGreaterThan(0);
    });

    it("should handle complex TypeScript constructs", () => {
      const code = `
        type ApiResponse<T> = {
          success: boolean;
          data?: T;
        };

        enum Status {
          Pending = "pending",
          Complete = "complete"
        }

        function process<T extends { id: string }>(item: T): ApiResponse<T> {
          return { success: true, data: item };
        }
      `;

      const tree = parser.parse(code);
      const captures = query_tree_and_parse_captures(
        "typescript" as Language,
        tree,
        "test.ts" as FilePath
      );

      // Verify type aliases and enums are captured
      const typeEntities = captures.definitions.map(c => c.entity);
      expect(typeEntities).toContain(SemanticEntity.TYPE_ALIAS);
      expect(typeEntities).toContain(SemanticEntity.ENUM);
      expect(typeEntities).toContain(SemanticEntity.FUNCTION);
    });
  });

  describe("Comprehensive Interface Testing", () => {
    it("should parse all interface patterns", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_interfaces.ts"),
        "utf-8"
      );
      const tree = parser.parse(code);
      const index = build_semantic_index(
        "comprehensive_interfaces.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check interface definitions
      const interfaces = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "interface"
      );
      expect(interfaces.length).toBeGreaterThan(10);

      const interfaceNames = interfaces.map(i => i.name);
      expect(interfaceNames).toContain("BasicInterface");
      expect(interfaceNames).toContain("GenericContainer");
      expect(interfaceNames).toContain("ExtendedUser");
      expect(interfaceNames).toContain("Calculator");
      expect(interfaceNames).toContain("Dictionary");
      expect(interfaceNames).toContain("HybridInterface");

      // Check exports
      const interfaceExports = index.exports.filter(
        (e) => interfaceNames.includes(e.symbol_name)
      );
      expect(interfaceExports.length).toBeGreaterThan(0);
    });

    it("should handle interface inheritance and implementation", () => {
      const code = `
        interface Base {
          id: string;
        }

        interface Extended extends Base {
          name: string;
        }

        class Implementation implements Extended {
          constructor(public id: string, public name: string) {}
        }
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      const interfaces = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "interface"
      );
      expect(interfaces.length).toBe(2);

      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );
      expect(classes.length).toBe(1);
      expect(classes[0].name).toBe("Implementation");
    });
  });

  describe("Comprehensive Generics Testing", () => {
    it("should parse all generic patterns", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_generics.ts"),
        "utf-8"
      );
      const tree = parser.parse(code);
      const index = build_semantic_index(
        "comprehensive_generics.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check generic functions
      const functions = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "function"
      );

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain("identity");
      expect(functionNames).toContain("combine");
      expect(functionNames).toContain("processLengthwise");
      expect(functionNames).toContain("extract");

      // Check generic classes
      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain("Container");
      expect(classNames).toContain("KeyValuePair");
      expect(classNames).toContain("Repository");
      expect(classNames).toContain("ExtendedContainer");
      expect(classNames).toContain("ArrayUtils");

      // Check type aliases
      const typeAliases = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "type_alias"
      );

      const typeNames = typeAliases.map(t => t.name);
      expect(typeNames).toContain("IsArray");
      expect(typeNames).toContain("ArrayElement");
      expect(typeNames).toContain("Optional");
    });

    it("should handle generic constraints and conditional types", () => {
      const code = `
        type Lengthwise = { length: number };

        function constrained<T extends Lengthwise>(arg: T): T {
          return arg;
        }

        type Conditional<T> = T extends string ? string[] : number[];

        class GenericClass<T, U extends keyof T> {
          extract(obj: T, key: U): T[U] {
            return obj[key];
          }
        }
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      const functions = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "function"
      );
      expect(functions.some(f => f.name === "constrained")).toBe(true);

      const typeAliases = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "type_alias"
      );
      expect(typeAliases.some(t => t.name === "Lengthwise")).toBe(true);
      expect(typeAliases.some(t => t.name === "Conditional")).toBe(true);

      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );
      expect(classes.some(c => c.name === "GenericClass")).toBe(true);
    });
  });

  describe("Comprehensive Class Testing", () => {
    it("should parse all class features", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_classes.ts"),
        "utf-8"
      );
      const tree = parser.parse(code);
      const index = build_semantic_index(
        "comprehensive_classes.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check classes
      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain("Person");
      expect(classNames).toContain("Employee");
      expect(classNames).toContain("Animal");
      expect(classNames).toContain("Dog");
      expect(classNames).toContain("Duck");
      expect(classNames).toContain("MathUtils");
      expect(classNames).toContain("GenericRepository");
      expect(classNames).toContain("DecoratedClass");
      expect(classNames).toContain("Temperature");

      // Check methods
      const methods = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "method"
      );
      expect(methods.length).toBeGreaterThan(20);

      // Check fields (class properties are categorized as variables)
      const fields = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "variable"
      );
      expect(fields.length).toBeGreaterThan(10);
    });

    it("should handle abstract classes and inheritance", () => {
      const code = `
        abstract class BaseClass {
          protected value: string = "";
          abstract process(): void;
          concrete(): string {
            return this.value;
          }
        }

        class ConcreteClass extends BaseClass {
          process(): void {
            this.value = "processed";
          }
        }

        interface Flyable {
          fly(): void;
        }

        class FlyingClass extends ConcreteClass implements Flyable {
          fly(): void {
            console.log("flying");
          }
        }
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );
      expect(classes.length).toBe(3);

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain("BaseClass");
      expect(classNames).toContain("ConcreteClass");
      expect(classNames).toContain("FlyingClass");

      const interfaces = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "interface"
      );
      expect(interfaces.length).toBe(1);
      expect(interfaces[0].name).toBe("Flyable");
    });

    it("should handle parameter properties", () => {
      const code = `
        class ParameterProperties {
          constructor(
            public name: string,
            private age: number,
            protected email: string,
            readonly id: string
          ) {}
        }
      `;

      const tree = parser.parse(code);

      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );
      expect(classes.length).toBe(1);
      expect(classes[0].name).toBe("ParameterProperties");

      // Parameter properties should create fields (categorized as variables)
      const fields = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "variable"
      );
      expect(fields.length).toBeGreaterThan(0);
    });
  });

  describe("Comprehensive Types Testing", () => {
    it("should parse all type patterns", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_types.ts"),
        "utf-8"
      );
      const tree = parser.parse(code);
      const index = build_semantic_index(
        "comprehensive_types.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check type aliases
      const typeAliases = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "type_alias"
      );

      const typeNames = typeAliases.map(t => t.name);
      expect(typeNames).toContain("StringOrNumber");
      expect(typeNames).toContain("ApiResponse");
      expect(typeNames).toContain("Repository");
      expect(typeNames).toContain("NonNullable");
      expect(typeNames).toContain("Optional");
      expect(typeNames).toContain("JsonValue");
      expect(typeNames).toContain("EventEmitter");

      // Check functions with type guards
      const functions = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "function"
      );

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain("isString");
      expect(functionNames).toContain("isUserData");
      expect(functionNames).toContain("assertIsString");

      // Check variables with complex types
      const variables = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "variable"
      );
      expect(variables.length).toBeGreaterThan(0);
    });

    it("should handle mapped and conditional types", () => {
      const code = `
        type Optional<T> = {
          [P in keyof T]?: T[P];
        };

        type Pick<T, K extends keyof T> = {
          [P in K]: T[P];
        };

        type Conditional<T> = T extends string ? true : false;

        type User = {
          id: string;
          name: string;
          email: string;
        };

        type PartialUser = Optional<User>;
        type UserName = Pick<User, 'name'>;
        type IsString = Conditional<string>;
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      const typeAliases = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "type_alias"
      );

      const typeNames = typeAliases.map(t => t.name);
      expect(typeNames).toContain("Optional");
      expect(typeNames).toContain("Pick");
      expect(typeNames).toContain("Conditional");
      expect(typeNames).toContain("User");
      expect(typeNames).toContain("PartialUser");
      expect(typeNames).toContain("UserName");
      expect(typeNames).toContain("IsString");
    });
  });

  describe("Comprehensive Enums Testing", () => {
    it("should parse all enum patterns", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_enums.ts"),
        "utf-8"
      );
      const tree = parser.parse(code);
      const index = build_semantic_index(
        "comprehensive_enums.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check enum definitions
      const enums = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "enum"
      );

      const enumNames = enums.map(e => e.name);
      expect(enumNames).toContain("Color");
      expect(enumNames).toContain("Direction");
      expect(enumNames).toContain("HttpStatus");
      expect(enumNames).toContain("MixedEnum");
      expect(enumNames).toContain("FileAccess");
      expect(enumNames).toContain("Theme");
      expect(enumNames).toContain("LogLevel");
      expect(enumNames).toContain("Planet");
      expect(enumNames).toContain("ApiEndpoint");
      expect(enumNames).toContain("HttpMethod");

      // Check functions that use enums
      const functions = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "function"
      );

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain("getColorHex");
      expect(functionNames).toContain("isSuccessStatus");
      expect(functionNames).toContain("canAccess");

      // Check variables with enum types
      const variables = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "variable"
      );
      expect(variables.some(v => v.name === "colorConfig")).toBe(true);
      expect(variables.some(v => v.name === "userOperations")).toBe(true);
    });

    it("should handle const enums and computed values", () => {
      const code = `
        const enum ConstEnum {
          A = "value_a",
          B = "value_b"
        }

        enum ComputedEnum {
          None = 0,
          Read = 1 << 1,
          Write = 1 << 2,
          ReadWrite = Read | Write
        }

        enum StringEnum {
          Success = "success",
          Error = "error",
          Pending = "pending"
        }
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      const enums = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "enum"
      );

      const enumNames = enums.map(e => e.name);
      expect(enumNames).toContain("ConstEnum");
      expect(enumNames).toContain("ComputedEnum");
      expect(enumNames).toContain("StringEnum");
    });
  });

  describe("Comprehensive Modules Testing", () => {
    it("should parse all import/export patterns", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_modules.ts"),
        "utf-8"
      );
      const tree = parser.parse(code);
      const index = build_semantic_index(
        "comprehensive_modules.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check imports
      expect(index.imports.length).toBeGreaterThan(0);

      // Check exports
      expect(index.exports.length).toBeGreaterThan(10);

      const exportNames = index.exports.map(e => e.symbol_name);
      expect(exportNames).toContain("ModuleConfig");
      expect(exportNames).toContain("ModuleManager");
      expect(exportNames).toContain("BaseModule");
      expect(exportNames).toContain("createModule");
      expect(exportNames).toContain("DEFAULT_CONFIG");
      expect(exportNames).toContain("ModuleStatus");

      // Check class definitions
      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain("ModuleManager");
      expect(classNames).toContain("BaseModule");
      expect(classNames).toContain("GenericModuleManager");

      // Check interface definitions
      const interfaces = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "interface"
      );

      const interfaceNames = interfaces.map(i => i.name);
      expect(interfaceNames).toContain("ModuleInterface");
      expect(interfaceNames).toContain("AsyncModuleInterface");
      expect(interfaceNames).toContain("PluginSystem");
    });

    it("should handle type-only imports and exports", () => {
      const code = `
        import type { User } from "./types";
        import { type Config, UserService } from "./services";

        export type { User };
        export type UserConfig = Config;

        export interface ApiResponse<T> {
          data: T;
          status: number;
        }

        export { UserService };
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check imports and exports
      expect(index.imports.length).toBeGreaterThan(0);
      expect(index.exports.length).toBeGreaterThan(0);

      const exportNames = index.exports.map(e => e.symbol_name);
      expect(exportNames).toContain("UserConfig");
      expect(exportNames).toContain("ApiResponse");
      expect(exportNames).toContain("UserService");
    });

    it("should handle namespace exports and re-exports", () => {
      const code = `
        export * from "./types";
        export * as Utils from "./utils";
        export { default as DefaultExport } from "./default";

        export namespace MyNamespace {
          export interface Config {
            setting: string;
          }

          export function helper(): void {}
        }
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check exports
      expect(index.exports.length).toBeGreaterThan(0);

      // Check namespace definition
      const namespaces = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "namespace"
      );
      expect(namespaces.some(n => n.name === "MyNamespace")).toBe(true);
    });
  });

  describe("Comprehensive Decorators Testing", () => {
    it("should parse all decorator patterns", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_decorators.ts"),
        "utf-8"
      );
      const tree = parser.parse(code);
      const index = build_semantic_index(
        "comprehensive_decorators.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check decorator functions
      const functions = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "function"
      );

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain("Entity");
      expect(functionNames).toContain("Sealed");
      expect(functionNames).toContain("Log");
      expect(functionNames).toContain("Benchmark");
      expect(functionNames).toContain("Retry");
      expect(functionNames).toContain("Cache");
      expect(functionNames).toContain("Required");

      // Check decorated classes
      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );

      const classNames = classes.map(c => c.name);
      expect(classNames).toContain("User");
      expect(classNames).toContain("UserController");
      expect(classNames).toContain("UserService");
      expect(classNames).toContain("ProductController");
      expect(classNames).toContain("Order");

      // Check methods in decorated classes
      const methods = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "method"
      );
      expect(methods.length).toBeGreaterThan(10);
    });

    it("should handle decorator factories and parameter decorators", () => {
      const code = `
        function validate(rule: string) {
          return function (target: any, propertyName: string, parameterIndex: number) {
            // Parameter decorator factory
          };
        }

        function route(path: string) {
          return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
            // Method decorator factory
          };
        }

        @Entity("users")
        class DecoratedUser {
          constructor(
            @validate("required") name: string,
            @validate("email") email: string
          ) {}

          @route("/users")
          @Log
          getUsers(): any[] {
            return [];
          }
        }
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      const functions = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "function"
      );
      expect(functions.some(f => f.name === "validate")).toBe(true);
      expect(functions.some(f => f.name === "route")).toBe(true);

      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );
      expect(classes.some(c => c.name === "DecoratedUser")).toBe(true);
    });
  });

  describe("Complex TypeScript Integration", () => {
    it("should handle mixed TypeScript features", () => {
      const code = `
        export namespace Api {
          export interface Config<T = any> {
            baseUrl: string;
            transform?: (data: T) => T;
          }

          export enum HttpMethod {
            GET = "GET",
            POST = "POST"
          }

          export type Response<T> = {
            success: boolean;
            data: T;
          };

          @Service
          export class ApiService<T> implements Service<T> {
            constructor(private config: Config<T>) {}

            @Cache(60000)
            async request<U>(
              @validate method: HttpMethod,
              @validate url: string,
              data?: T
            ): Promise<Response<U>> {
              return { success: true, data: {} as U };
            }
          }
        }

        interface Service<T> {
          request<U>(method: Api.HttpMethod, url: string, data?: T): Promise<Api.Response<U>>;
        }

        export default Api.ApiService;
      `;

      const tree = parser.parse(code);
      const index = build_semantic_index(
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Check namespace
      const namespaces = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "namespace"
      );
      expect(namespaces.some(n => n.name === "Api")).toBe(true);

      // Check interface inside namespace
      const interfaces = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "interface"
      );
      expect(interfaces.some(i => i.name === "Config")).toBe(true);
      expect(interfaces.some(i => i.name === "Service")).toBe(true);

      // Check enum inside namespace
      const enums = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "enum"
      );
      expect(enums.some(e => e.name === "HttpMethod")).toBe(true);

      // Check class inside namespace
      const classes = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "class"
      );
      expect(classes.some(c => c.name === "ApiService")).toBe(true);

      // Check type aliases
      const typeAliases = Array.from(index.symbols.values()).filter(
        (sym) => sym.kind === "type_alias"
      );
      expect(typeAliases.some(t => t.name === "Response")).toBe(true);

      // Check exports
      expect(index.exports.length).toBeGreaterThan(0);
    });

    it("should handle error cases gracefully", () => {
      const invalidCode = `
        interface {
          // Missing name
        }

        class {
          // Missing name
        }

        enum {
          // Missing name
        }
      `;

      const tree = parser.parse(invalidCode);

      // Should not throw
      expect(() => {
        build_semantic_index(
          "invalid.ts" as FilePath,
          tree,
          "typescript" as Language
        );
      }).not.toThrow();
    });
  });
});