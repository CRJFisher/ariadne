/**
 * Comprehensive TypeScript definitions test fixture
 * Tests all symbol definition types and edge cases
 */

// Basic functions
function simple_function() {
  return "hello";
}

const arrow_function = () => {
  return "arrow";
};

async function async_function(): Promise<string> {
  return "async";
}

function* generator_function(): Generator<number> {
  yield 1;
  yield 2;
}

// Generic functions
function generic_function<T>(param: T): T {
  return param;
}

function constrained_generic<T extends string>(param: T): T {
  return param;
}

// Variables and constants
const string_constant = "hello";
const number_variable = 42;
const hoisted_variable = "hoisted";

// Basic class
class SimpleClass {
  public name: string;
  private age: number;
  protected email: string;
  readonly id: string;

  constructor(name: string, age: number, email: string, id: string) {
    this.name = name;
    this.age = age;
    this.email = email;
    this.id = id;
  }

  public get_name(): string {
    return this.name;
  }

  private get_age(): number {
    return this.age;
  }

  protected get_email(): string {
    return this.email;
  }

  static create_default(): SimpleClass {
    return new SimpleClass("default", 0, "default@example.com", "default");
  }
}

// Generic class
class GenericClass<T, U> {
  private data: T;
  private metadata: U;

  constructor(data: T, metadata: U) {
    this.data = data;
    this.metadata = metadata;
  }

  get_data(): T {
    return this.data;
  }

  get_metadata(): U {
    return this.metadata;
  }

  static create<T, U>(data: T, metadata: U): GenericClass<T, U> {
    return new GenericClass(data, metadata);
  }
}

// Abstract class
abstract class AbstractBase {
  protected value: string = "";

  abstract process(): void;

  concrete(): string {
    return this.value;
  }
}

class ConcreteImplementation extends AbstractBase {
  process(): void {
    this.value = "processed";
  }
}

// Interfaces
interface BasicInterface {
  id: string;
  name: string;
}

interface GenericInterface<T> {
  data: T;
  process(input: T): T;
}

interface ExtendedInterface extends BasicInterface {
  description: string;
  get_value(): string;
}

// Interface with call signature
interface CallableInterface {
  (input: string): string;
  property: number;
}

// Interface with index signature
interface IndexableInterface {
  [key: string]: any;
  known_property: string;
}

// Type aliases
type StringAlias = string;
type GenericAlias<T> = T[];
type UnionType = string | number;
type IntersectionType = BasicInterface & { extra: boolean };
type ConditionalType<T> = T extends string ? true : false;
type MappedType<T> = {
  [K in keyof T]: T[K] | null;
};

// Enums
enum BasicEnum {
  FIRST,
  SECOND,
  THIRD
}

enum StringEnum {
  SUCCESS = "success",
  ERROR = "error",
  PENDING = "pending"
}

enum ComputedEnum {
  NONE = 0,
  READ = 1 << 1,
  WRITE = 1 << 2,
  READ_WRITE = READ | WRITE
}

const enum ConstEnum {
  A = "value_a",
  B = "value_b"
}

// Namespaces
namespace BasicNamespace {
  export interface NestedInterface {
    value: string;
  }

  export class NestedClass {
    constructor(public data: string) {}
  }

  export function nested_function(): string {
    return "nested";
  }

  export const nested_constant = "constant";

  export namespace InnerNamespace {
    export type InnerType = string;
    export const inner_value = 42;
  }
}

// Modules (TypeScript modules)
// declare module "external-module" {
//   export interface ExternalInterface {
//     method(): void;
//   }
//   export function externalFunction(): string;
// }

// Parameter properties
class ParameterProperties {
  constructor(
    public name: string,
    private age: number,
    protected email: string,
    readonly id: string,
  ) {}
}

// Method overloads
class OverloadedMethods {
  process(input: string): string;
  process(input: number): number;
  process(input: string | number): string | number {
    return input;
  }
}

// Decorators (if available)
function class_decorator(target: any) {
  return target;
}

function method_decorator(target: any, property_key: string, descriptor: PropertyDescriptor) {
  return descriptor;
}

function property_decorator(target: any, property_key: string) {
  // Property decorator
}

function parameter_decorator(target: any, property_key: string, parameter_index: number) {
  // Parameter decorator
}

@class_decorator
class DecoratedClass {
  @property_decorator
    decorated_property: string = "";

  @method_decorator
  decorated_method(@parameter_decorator param: string): string {
    return param;
  }
}

// Getters and setters
class GetterSetterClass {
  private _value: string = "";

  get value(): string {
    return this._value;
  }

  set value(new_value: string) {
    this._value = new_value;
  }
}

// Static blocks (ES2022)
class StaticBlockClass {
  static static_property: string;

  static {
    this.static_property = "initialized";
  }
}

// Complex nested structures
class OuterClass {
  private inner_value: string = "";

  public method(): void {
    // Local class
    class LocalClass {
      constructor(public data: string) {}

      process(): string {
        return this.data;
      }
    }

    // Local function
    function local_function(): string {
      // Local variable
      const local_var = "local";
      return local_var;
    }

    const instance = new LocalClass("test");
    const result = local_function();
  }
}

// Export statements
export { SimpleClass, GenericClass };
export type { BasicInterface, GenericInterface };
export { BasicEnum, StringEnum };
export default ConcreteImplementation;
export * from "./other-module";
export { SpecificExport } from "./specific-module";