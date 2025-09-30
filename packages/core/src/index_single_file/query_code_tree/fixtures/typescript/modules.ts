// @ts-nocheck
// TypeScript module features

// Type imports and exports
import type { User } from "./interfaces";
import { type Admin, UserImpl } from "./interfaces";

// Type-only export
export type { User };

// Named type exports
export type StringArray = string[];
export type NumberArray = number[];

// Interface export
export interface Config {
  apiUrl: string;
  timeout: number;
  retries?: number;
}

// Type alias export
export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Enum export
export enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING",
}

// Namespace
export namespace Utils {
  export function format(value: string): string {
    return value.toUpperCase();
  }

  export interface Options {
    caseSensitive: boolean;
  }

  export const VERSION = "1.0.0";
}

// Module declaration
declare module "custom-module" {
  export function customFunction(): void;
  export interface CustomType {
    prop: string;
  }
}

// Global augmentation
declare global {
  interface Window {
    customProperty: string;
  }
}

// Re-export with type
export { UserImpl } from "./interfaces";
export type { Admin as AdminUser } from "./interfaces";