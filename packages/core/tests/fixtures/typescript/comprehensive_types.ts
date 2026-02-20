// @ts-nocheck
// Comprehensive types and type aliases testing

// Basic type aliases
export type StringOrNumber = string | number;
export type StringOrNumberArray = (string | number)[];
export type Callback<T> = (data: T) => void;
export type AsyncCallback<T, R> = (data: T) => Promise<R>;

// Union types
export type Status = "pending" | "approved" | "rejected";
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type Theme = "light" | "dark" | "auto";

// Intersection types
export type Person = {
  name: string;
  age: number;
};

export type Employee = {
  employee_id: string;
  department: string;
  salary: number;
};

export type PersonWithEmployeeInfo = Person & Employee;

// Advanced intersection
export type Timestamped = {
  created_at: Date;
  updated_at: Date;
};

export type Identifiable = {
  id: string;
};

export type AuditableEntity = Identifiable & Timestamped & {
  version: number;
  last_modified_by: string;
};

// Generic type aliases
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

export type Repository<T> = {
  find_by_id(id: string): Promise<T | null>;
  find_all(): Promise<T[]>;
  create(entity: Omit<T, "id">): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
};

// Conditional types
export type NonNullable<T> = T extends null | undefined ? never : T;
export type IsArray<T> = T extends any[] ? true : false;
export type ArrayElement<T> = T extends (infer U)[] ? U : never;
export type FunctionReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// Mapped types
export type Optional<T> = {
  [P in keyof T]?: T[P];
};

export type RequiredAndReadonly<T> = {
  readonly [P in keyof T]-?: T[P];
};

export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

// Template literal types
export type EventName<T extends string> = `on${Capitalize<T>}`;
export type HttpsUrl = `https://${string}`;
export type EmailAddress = `${string}@${string}.${string}`;
export type CssLength = `${number}${"px" | "em" | "rem" | "%"}`;

// Key remapping
export type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

export type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

// Recursive types
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Utility types usage
export type UserData = {
  id: string;
  name: string;
  email: string;
  age: number;
  active: boolean;
  profile?: {
    avatar: string;
    bio: string;
  };
};

export type CreateUserRequest = Omit<UserData, "id">;
export type UpdateUserRequest = Partial<Pick<UserData, "name" | "email" | "profile">>;
export type UserSummary = Pick<UserData, "id" | "name" | "email">;
export type ActiveUser = Required<UserData>;

// Index types
export type StringDict = { [key: string]: string };
export type NumberDict = { [key: string]: number };
export type MixedDict = { [key: string]: string | number | boolean };

// Function types
export type Predicate<T> = (value: T) => boolean;
export type Transformer<T, U> = (value: T) => U;
export type Reducer<T, R> = (accumulator: R, current: T, index: number) => R;
export type EventHandler<T = any> = (event: T) => void;

// Complex function types
export type Middleware<T> = (input: T, next: (modified: T) => void) => void;
export type Validator<T> = {
  validate: (value: T) => boolean;
  message: string;
};

// Object types with complex signatures
export type EventEmitter<T extends Record<string, any[]>> = {
  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void;
  emit<K extends keyof T>(event: K, ...args: T[K]): void;
  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void;
};

// Usage example
export type MyEvents = {
  user_created: [UserData];
  user_updated: [string, Partial<UserData>];
  user_deleted: [string];
  error: [Error, string];
};

export type MyEventEmitter = EventEmitter<MyEvents>;

// Brand types (nominal typing)
// eslint-disable-next-line @typescript-eslint/naming-convention
export type UserId = string & { readonly __brand: unique symbol };
// eslint-disable-next-line @typescript-eslint/naming-convention
export type Email = string & { readonly __brand: unique symbol };
// eslint-disable-next-line @typescript-eslint/naming-convention
export type Timestamp = number & { readonly __brand: unique symbol };

// Type guards
export function is_string(value: unknown): value is string {
  return typeof value === "string";
}

export function is_number(value: unknown): value is number {
  return typeof value === "number";
}

export function is_user_data(value: unknown): value is UserData {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "email" in value;
}

// Assertion functions
export function assert_is_string(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error("Expected string");
  }
}

export function assert_is_user_data(value: unknown): asserts value is UserData {
  if (!is_user_data(value)) {
    throw new Error("Expected UserData");
  }
}

// Module augmentation example
declare global {
  interface Window {
    custom_property: string;
    my_api: {
      version: string;
      methods: string[];
    };
  }

  namespace NodeJS {
    interface ProcessEnv {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      CUSTOM_VAR: string;
      // eslint-disable-next-line @typescript-eslint/naming-convention
      DEBUG_MODE: string;
    }
  }
}

// Namespace with types
export namespace Api {
  export type Config = {
    base_url: string;
    timeout: number;
    retries: number;
  };

  export type Response<T> = {
    data: T;
    status: number;
    headers: Record<string, string>;
  };

  export type Error = {
    message: string;
    code: string;
    details?: any;
  };
}

// Complex example combining multiple features
export type DatabaseEntity = {
  id: string;
  created_at: Date;
  updated_at: Date;
  version: number;
};

export type WithDatabase<T> = T & DatabaseEntity;

export type ServiceResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  code: number;
};

export type CrudService<T extends DatabaseEntity> = {
  create(data: Omit<T, keyof DatabaseEntity>): Promise<ServiceResponse<T>>;
  read(id: string): Promise<ServiceResponse<T>>;
  update(id: string, data: Partial<Omit<T, keyof DatabaseEntity>>): Promise<ServiceResponse<T>>;
  delete(id: string): Promise<ServiceResponse<boolean>>;
  list(filters?: Partial<T>): Promise<ServiceResponse<T[]>>;
};

// Final complex example
export type AsyncIterableTransformer<T, U> = {
  (source: AsyncIterable<T>): AsyncIterable<U>;
  parallel?: boolean;
  batch_size?: number;
};