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
  api_url: string;
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
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING = "PENDING",
}

// Namespace
export namespace Utils {
  export function format(value: string): string {
    return value.toUpperCase();
  }

  export interface Options {
    case_sensitive: boolean;
  }

  export const VERSION = "1.0.0";
}

// Module declaration
declare module "custom-module" {
  export function custom_function(): void;
  export interface CustomType {
    prop: string;
  }
}

// Global augmentation
declare global {
  interface Window {
    custom_property: string;
  }
}

// Re-export with type
export { UserImpl } from "./interfaces";
export type { Admin as AdminUser } from "./interfaces";