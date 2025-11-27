// Type aliases and type annotations

// Type alias
type StringOrNumber = string | number;
type Callback<T> = (data: T) => void;
type Nullable<T> = T | null;
type ReadonlyUser = Readonly<User>;

// Intersection type
type Employee = {
  employee_id: number;
  department: string;
};

type Manager = Employee & {
  team_size: number;
  reports: Employee[];
};

// Conditional type
type IsString<T> = T extends string ? true : false;

// Mapped type
type Optional<T> = {
  [P in keyof T]?: T[P];
};

// Literal types
type Direction = "north" | "south" | "east" | "west";
type StatusCode = 200 | 404 | 500;

// Interface for testing
interface User {
  id: number;
  name: string;
}

// Function with type annotations
function process_user(user: User): void {
  console.log(user.name);
}

// Variable with type annotation
const user_name: string = "Alice";
const user_id: number = 123;
const is_active: boolean = true;

// Array type annotations
const numbers: number[] = [1, 2, 3];
const strings: Array<string> = ["a", "b", "c"];
const mixed: (string | number)[] = ["a", 1, "b", 2];

// Tuple type
const tuple: [string, number, boolean] = ["test", 42, true];

// Object type annotation
const config: { port: number; host: string; secure?: boolean } = {
  port: 3000,
  host: "localhost",
};

// Function type annotation
const add: (a: number, b: number) => number = (a, b) => a + b;

// Type assertions
const some_value: unknown = "this is a string";
const str_length1 = (some_value as string).length;
const str_length2 = (<string>some_value).length;

// typeof operator
const original = { x: 10, y: 20 };
const copy: typeof original = { x: 30, y: 40 };