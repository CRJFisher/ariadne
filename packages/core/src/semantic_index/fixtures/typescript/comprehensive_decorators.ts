// @ts-nocheck
// Comprehensive decorators testing

// Mock Reflect metadata for testing
declare global {
  namespace Reflect {
    function getMetadata(
      key: string,
      target: any,
      propertyName?: string | symbol
    ): any;
    function defineMetadata(
      key: string,
      value: any,
      target: any,
      propertyName?: string | symbol
    ): void;
  }
}

// Simple implementation for testing
globalThis.Reflect = {
  ...Reflect,
  getMetadata: (key: string, target: any, propertyName?: string | symbol) =>
    undefined,
  defineMetadata: (
    key: string,
    value: any,
    target: any,
    propertyName?: string | symbol
  ) => {},
};

// Class decorators
export function Entity(tableName: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      __tableName = tableName;
      __isEntity = true;
    };
  };
}

export function Sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

export function Timestamped<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  return class extends constructor {
    createdAt = new Date();
    updatedAt = new Date();

    touch() {
      this.updatedAt = new Date();
    }
  };
}

// Method decorators
export function Log(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    console.log(
      `[${new Date().toISOString()}] Calling ${propertyName} with args:`,
      args
    );
    const result = originalMethod.apply(this, args);
    console.log(
      `[${new Date().toISOString()}] ${propertyName} returned:`,
      result
    );
    return result;
  };

  return descriptor;
}

export function Benchmark(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const end = performance.now();
    console.log(`${propertyName} took ${end - start} milliseconds`);
    return result;
  };

  return descriptor;
}

export function Retry(times: number = 3) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let i = 0; i < times; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          if (i === times - 1) {
            throw error;
          }
          console.log(`Attempt ${i + 1} failed, retrying...`);
        }
      }
    };

    return descriptor;
  };
}

export function Cache(ttl: number = 60000) {
  const cache = new Map<string, { value: any; expiry: number }>();

  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const key = `${propertyName}_${JSON.stringify(args)}`;
      const cached = cache.get(key);

      if (cached && Date.now() < cached.expiry) {
        return cached.value;
      }

      const result = originalMethod.apply(this, args);
      cache.set(key, { value: result, expiry: Date.now() + ttl });

      return result;
    };

    return descriptor;
  };
}

// Property decorators
export function Required(target: any, propertyName: string) {
  let value = target[propertyName];

  const getter = () => value;
  const setter = (newValue: any) => {
    if (newValue === null || newValue === undefined) {
      throw new Error(
        `Property ${propertyName} is required and cannot be null or undefined`
      );
    }
    value = newValue;
  };

  Object.defineProperty(target, propertyName, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true,
  });
}

export function MinLength(min: number) {
  return function (target: any, propertyName: string) {
    let value = target[propertyName];

    const getter = () => value;
    const setter = (newValue: any) => {
      if (typeof newValue === "string" && newValue.length < min) {
        throw new Error(
          `Property ${propertyName} must be at least ${min} characters long`
        );
      }
      value = newValue;
    };

    Object.defineProperty(target, propertyName, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

export function ReadOnly(target: any, propertyName: string) {
  const initialValue = target[propertyName];
  let hasBeenSet = false;

  const getter = () => initialValue;
  const setter = (newValue: any) => {
    if (hasBeenSet) {
      throw new Error(
        `Property ${propertyName} is read-only and cannot be modified`
      );
    }
    hasBeenSet = true;
  };

  Object.defineProperty(target, propertyName, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: false,
  });
}

// Parameter decorators
export function Inject(token: string) {
  return function (
    target: any,
    propertyName: string | symbol | undefined,
    parameterIndex: number
  ) {
    // Store metadata about the injection
    const existingTokens = Reflect.getMetadata("inject:tokens", target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata("inject:tokens", existingTokens, target);
  };
}

export function Validate(validator: (value: any) => boolean, message?: string) {
  return function (
    target: any,
    propertyName: string | symbol | undefined,
    parameterIndex: number
  ) {
    const existingValidators =
      Reflect.getMetadata("validate:params", target, propertyName!) || [];
    existingValidators[parameterIndex] = { validator, message };
    Reflect.defineMetadata(
      "validate:params",
      existingValidators,
      target,
      propertyName!
    );
  };
}

// Accessor decorators
export function Memoize(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const originalGetter = descriptor.get;
  const cache = new WeakMap();

  if (originalGetter) {
    descriptor.get = function () {
      if (cache.has(this)) {
        return cache.get(this);
      }

      const result = originalGetter.apply(this);
      cache.set(this, result);
      return result;
    };
  }

  return descriptor;
}

// Factory decorators
export function Column(
  options: { name?: string; type?: string; nullable?: boolean } = {}
) {
  return function (target: any, propertyName: string) {
    const columns = Reflect.getMetadata("columns", target) || [];
    columns.push({
      propertyName,
      columnName: options.name || propertyName,
      type: options.type || "varchar",
      nullable: options.nullable || false,
    });
    Reflect.defineMetadata("columns", columns, target);
  };
}

export function Route(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET"
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const routes = Reflect.getMetadata("routes", target) || [];
    routes.push({
      path,
      method,
      handler: propertyName,
      originalMethod: descriptor.value,
    });
    Reflect.defineMetadata("routes", routes, target);
  };
}

// Multiple decorators on single class
@Entity("users")
@Sealed
@Timestamped
export class User {
  @Column({ name: "user_id", type: "uuid" })
  @Required
  id: string;

  @Column({ name: "user_name", type: "varchar" })
  @Required
  @MinLength(2)
  name: string;

  @Column({ name: "email_address", type: "varchar" })
  @Required
  email: string;

  @Column({ name: "age", type: "integer", nullable: true })
  age?: number;

  @ReadOnly
  readonly created: Date = new Date();

  constructor(
    @Inject("id_generator") id: string,
    @Validate(
      (value) => typeof value === "string" && value.length > 0,
      "Name is required"
    )
    name: string,
    email: string
  ) {
    this.id = id;
    this.name = name;
    this.email = email;
  }

  @Log
  @Benchmark
  getName(): string {
    return this.name;
  }

  @Log
  @Cache(30000)
  getDisplayName(): string {
    return `${this.name} (${this.email})`;
  }

  @Retry(3)
  async saveToDatabase(): Promise<void> {
    // Simulate database operation that might fail
    if (Math.random() < 0.7) {
      throw new Error("Database connection failed");
    }
    console.log("User saved successfully");
  }

  @Memoize
  get fullInfo(): string {
    // Expensive computation
    return `${this.name} - ${this.email} - ${this.age || "Unknown age"}`;
  }
}

// Controller with route decorators
export class UserController {
  @Route("/users", "GET")
  @Log
  @Cache(60000)
  async getUsers(): Promise<User[]> {
    // Simulate fetching users
    return [];
  }

  @Route("/users/:id", "GET")
  @Log
  @Benchmark
  async getUserById(
    @Validate((id) => typeof id === "string" && id.length > 0) id: string
  ): Promise<User | null> {
    // Simulate fetching user by ID
    return null;
  }

  @Route("/users", "POST")
  @Log
  @Retry(2)
  async createUser(
    @Validate((data) => data && data.name && data.email) userData: any
  ): Promise<User> {
    // Simulate user creation
    return new User("generated-id", userData.name, userData.email);
  }

  @Route("/users/:id", "PUT")
  @Log
  @Benchmark
  async updateUser(
    @Validate((id) => typeof id === "string" && id.length > 0) id: string,
    @Validate((data) => data && typeof data === "object") updateData: any
  ): Promise<User | null> {
    // Simulate user update
    return null;
  }

  @Route("/users/:id", "DELETE")
  @Log
  @Retry(3)
  async deleteUser(
    @Validate((id) => typeof id === "string" && id.length > 0) id: string
  ): Promise<boolean> {
    // Simulate user deletion
    return true;
  }
}

// Service with multiple decorators
@Entity("user_service")
export class UserService {
  @Log
  @Cache(120000)
  async findActiveUsers(): Promise<User[]> {
    return [];
  }

  @Log
  @Benchmark
  @Retry(2)
  async validateUserEmail(
    @Validate((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email: string
  ): Promise<boolean> {
    // Simulate email validation
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }

  @Memoize
  get serviceInfo(): { version: string; uptime: number } {
    return {
      version: "1.0.0",
      uptime: Date.now(),
    };
  }
}

// Mixed decorator patterns
export function ApiController(prefix: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    Reflect.defineMetadata("api:prefix", prefix, constructor);
    return constructor;
  };
}

export function Middleware(middleware: Function) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const middlewares =
      Reflect.getMetadata("middlewares", target, propertyName) || [];
    middlewares.push(middleware);
    Reflect.defineMetadata("middlewares", middlewares, target, propertyName);
  };
}

@ApiController("/api/v1")
export class ProductController {
  @Route("/products", "GET")
  @Middleware((req: any, res: any, next: any) => {
    console.log("Auth middleware");
    next();
  })
  @Middleware((req: any, res: any, next: any) => {
    console.log("Logging middleware");
    next();
  })
  @Log
  @Cache(30000)
  async getProducts(): Promise<any[]> {
    return [];
  }
}

// Decorator composition
export function Auditable<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  return class extends constructor {
    auditLog: string[] = [];

    addAuditEntry(action: string) {
      this.auditLog.push(`${new Date().toISOString()}: ${action}`);
    }
  };
}

@Entity("orders")
@Timestamped
@Auditable
export class Order {
  @Column({ name: "order_id" })
  @Required
  id: string;

  @Column({ name: "total_amount" })
  @Required
  total: number;

  constructor(id: string, total: number) {
    this.id = id;
    this.total = total;
  }

  @Log
  @Benchmark
  calculate(): number {
    return this.total * 1.1; // Add tax
  }
}
