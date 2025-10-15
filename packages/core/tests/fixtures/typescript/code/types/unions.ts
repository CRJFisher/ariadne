/**
 * Union types
 * Tests: union types, discriminated unions, type guards
 */

// Simple unions
type StringOrNumber = string | number;
type Status = "pending" | "active" | "completed" | "failed";
type ID = string | number | symbol;

// Union of object types
type Success = {
  type: "success";
  data: any;
};

type Failure = {
  type: "failure";
  error: string;
};

type Result = Success | Failure;

// Discriminated union
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; size: number }
  | { kind: "rectangle"; width: number; height: number };

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.size ** 2;
    case "rectangle":
      return shape.width * shape.height;
  }
}

// Union with null/undefined
type Maybe<T> = T | null | undefined;
type Optional<T> = T | undefined;

export { StringOrNumber, Status, ID, Result, Shape, Maybe, Optional, getArea };
