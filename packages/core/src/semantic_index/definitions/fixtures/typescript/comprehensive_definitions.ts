/**
 * Comprehensive TypeScript definitions test fixture
 * Tests all symbol definition types and edge cases
 */

// Basic functions
function simpleFunction() {
  return "hello";
}

const arrowFunction = () => {
  return "arrow";
};

async function asyncFunction(): Promise<string> {
  return "async";
}

function* generatorFunction(): Generator<number> {
  yield 1;
  yield 2;
}

// Generic functions
function genericFunction<T>(param: T): T {
  return param;
}

function constrainedGeneric<T extends string>(param: T): T {
  return param;
}

// Variables and constants
const stringConstant = "hello";
let numberVariable = 42;
var hoistedVariable = "hoisted";

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

  public getName(): string {
    return this.name;
  }

  private getAge(): number {
    return this.age;
  }

  protected getEmail(): string {
    return this.email;
  }

  static createDefault(): SimpleClass {
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

  getData(): T {
    return this.data;
  }

  getMetadata(): U {
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
  getValue(): string;
}

// Interface with call signature
interface CallableInterface {
  (input: string): string;
  property: number;
}

// Interface with index signature
interface IndexableInterface {
  [key: string]: any;
  knownProperty: string;
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
  First,
  Second,
  Third
}

enum StringEnum {
  Success = "success",
  Error = "error",
  Pending = "pending"
}

enum ComputedEnum {
  None = 0,
  Read = 1 << 1,
  Write = 1 << 2,
  ReadWrite = Read | Write
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

  export function nestedFunction(): string {
    return "nested";
  }

  export const nestedConstant = "constant";

  export namespace InnerNamespace {
    export type InnerType = string;
    export const innerValue = 42;
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
    readonly id: string
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
function ClassDecorator(target: any) {
  return target;
}

function MethodDecorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  return descriptor;
}

function PropertyDecorator(target: any, propertyKey: string) {
  // Property decorator
}

function ParameterDecorator(target: any, propertyKey: string, parameterIndex: number) {
  // Parameter decorator
}

@ClassDecorator
class DecoratedClass {
  @PropertyDecorator
  decoratedProperty: string = "";

  @MethodDecorator
  decoratedMethod(@ParameterDecorator param: string): string {
    return param;
  }
}

// Getters and setters
class GetterSetterClass {
  private _value: string = "";

  get value(): string {
    return this._value;
  }

  set value(newValue: string) {
    this._value = newValue;
  }
}

// Static blocks (ES2022)
class StaticBlockClass {
  static staticProperty: string;

  static {
    this.staticProperty = "initialized";
  }
}

// Complex nested structures
class OuterClass {
  private innerValue: string = "";

  public method(): void {
    // Local class
    class LocalClass {
      constructor(public data: string) {}

      process(): string {
        return this.data;
      }
    }

    // Local function
    function localFunction(): string {
      // Local variable
      const localVar = "local";
      return localVar;
    }

    const instance = new LocalClass("test");
    const result = localFunction();
  }
}

// Export statements
export { SimpleClass, GenericClass };
export type { BasicInterface, GenericInterface };
export { BasicEnum, StringEnum };
export default ConcreteImplementation;
export * from "./other-module";
export { SpecificExport } from "./specific-module";