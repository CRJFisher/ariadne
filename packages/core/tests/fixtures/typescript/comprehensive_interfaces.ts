// @ts-nocheck
// Comprehensive interface testing
export interface BasicInterface {
  id: number;
  name: string;
  optional?: boolean;
  readonly immutable: string;
}

// Interface with generics
export interface GenericContainer<T, U = string> {
  value: T;
  metadata: U;
  transform<V>(input: T): V;
}

// Interface with constraints
export interface Constrained<T extends string | number> {
  data: T;
  validator: (value: T) => boolean;
}

// Interface inheritance
export interface ExtendedUser extends BasicInterface {
  email: string;
  permissions: string[];
}

// Multiple inheritance
export interface AdminUser extends BasicInterface, ExtendedUser {
  admin_level: number;
  can_delete: boolean;
}

// Interface with method signatures
export interface Calculator {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
}

// Interface with index signatures
export interface Dictionary<T> {
  [key: string]: T;
  readonly length: number;
}

export interface NumericDictionary {
  [index: number]: string;
  [key: string]: any;
}

// Interface with call signatures
export interface Callable {
  (input: string): number;
  property: boolean;
}

// Interface with construct signatures
export interface Constructable {
  new (name: string): { name: string };
}

// Merged interfaces (declaration merging)
export interface MergedInterface {
  prop1: string;
}

export interface MergedInterface {
  prop2: number;
}

// Interface implementing other interfaces
export interface ComplexInterface extends GenericContainer<string, number> {
  additional: boolean;
  calculate: Calculator;
}

// Conditional type interface
export interface ConditionalType<T> {
  value: T extends string ? string[] : number[];
}

// Hybrid interface (combining multiple patterns)
export interface HybridInterface<T extends Record<string, any> = {}> {
  readonly id: string;
  data: T;
  [key: `prefix_${string}`]: any;

  // Method signatures
  process<U>(input: T): Promise<U>;
  validate(data: T): data is Required<T>;

  // Call signature
  (action: string): void;

  // Construct signature
  new (config: T): HybridInterface<T>;
}