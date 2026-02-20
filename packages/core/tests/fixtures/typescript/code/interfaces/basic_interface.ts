/**
 * Basic interface definitions
 * Tests: interface declarations, optional properties, method signatures
 */

interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}

interface Product {
  readonly id: string;
  name: string;
  price: number;
  in_stock: boolean;
}

interface Repository<T> {
  find_by_id(id: string): T | null;
  find_all(): T[];
  save(item: T): void;
  delete(id: string): boolean;
}

// Interface with method signatures
interface Calculator {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
}

// Interface with index signature
interface Dictionary {
  [key: string]: string;
}

export { User, Product, Repository, Calculator, Dictionary };
