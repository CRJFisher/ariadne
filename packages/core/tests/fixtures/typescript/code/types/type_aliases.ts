/**
 * Type alias definitions
 * Tests: type aliases, object types, function types
 */

// Simple type aliases
type ID = string | number;
type Age = number;
type Email = string;

// Object type alias
type User = {
  id: ID;
  name: string;
  email: Email;
  age?: Age;
};

// Function type alias
type Predicate<T> = (value: T) => boolean;
type Mapper<T, U> = (value: T) => U;
type Comparator<T> = (a: T, b: T) => number;

// Tuple types
type Point2D = [number, number];
type Point3D = [number, number, number];
type RGB = [number, number, number];

// Complex type aliases
type Result<T, E = Error> = {
  success: true;
  value: T;
} | {
  success: false;
  error: E;
};

type AsyncFunction<T> = () => Promise<T>;

export type {
  ID,
  Age,
  Email,
  User,
  Predicate,
  Mapper,
  Comparator,
  Point2D,
  Point3D,
  RGB,
  Result,
  AsyncFunction,
};
