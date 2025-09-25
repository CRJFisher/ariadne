// @ts-nocheck
// Comprehensive enum testing

// Basic string enum
export enum Color {
  Red = "red",
  Green = "green",
  Blue = "blue",
  Yellow = "yellow",
  Purple = "purple"
}

// Basic numeric enum
export enum Direction {
  Up,    // 0
  Down,  // 1
  Left,  // 2
  Right  // 3
}

// Enum with explicit numeric values
export enum HttpStatus {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  InternalServerError = 500
}

// Mixed enum (string and computed values)
export enum MixedEnum {
  A,                    // 0
  B,                    // 1
  C = "custom",         // "custom"
  D,                    // computed from "custom"
  E = 100,              // 100
  F                     // 101
}

// Enum with computed values
export enum FileAccess {
  None = 0,
  Read = 1 << 1,      // 2
  Write = 1 << 2,     // 4
  Execute = 1 << 3,   // 8
  ReadWrite = Read | Write,                    // 6
  ReadExecute = Read | Execute,                // 10
  WriteExecute = Write | Execute,              // 12
  All = Read | Write | Execute                 // 14
}

// Const enum (compile-time optimization)
export const enum Theme {
  Light = "light",
  Dark = "dark",
  Auto = "auto"
}

// Ambient enum (declare)
declare enum ExternalEnum {
  Value1,
  Value2,
  Value3
}

// Reverse mapping demonstration
export enum LogLevel {
  Error = 0,
  Warning = 1,
  Info = 2,
  Debug = 3
}

// Functions using enums
export function getColorHex(color: Color): string {
  switch (color) {
    case Color.Red:
      return "#FF0000";
    case Color.Green:
      return "#00FF00";
    case Color.Blue:
      return "#0000FF";
    case Color.Yellow:
      return "#FFFF00";
    case Color.Purple:
      return "#800080";
    default:
      return "#000000";
  }
}

export function isSuccessStatus(status: HttpStatus): boolean {
  return status >= HttpStatus.OK && status < 300;
}

export function canAccess(required: FileAccess, available: FileAccess): boolean {
  return (available & required) === required;
}

// Enum as object keys
export type ColorSettings = {
  [key in Color]: {
    hex: string;
    rgb: [number, number, number];
  };
};

export const colorConfig: ColorSettings = {
  [Color.Red]: { hex: "#FF0000", rgb: [255, 0, 0] },
  [Color.Green]: { hex: "#00FF00", rgb: [0, 255, 0] },
  [Color.Blue]: { hex: "#0000FF", rgb: [0, 0, 255] },
  [Color.Yellow]: { hex: "#FFFF00", rgb: [255, 255, 0] },
  [Color.Purple]: { hex: "#800080", rgb: [128, 0, 128] }
};

// Enum with methods (via namespace merging)
export enum Planet {
  Mercury = "mercury",
  Venus = "venus",
  Earth = "earth",
  Mars = "mars",
  Jupiter = "jupiter",
  Saturn = "saturn",
  Uranus = "uranus",
  Neptune = "neptune"
}

export namespace Planet {
  export function isTerrestrial(planet: Planet): boolean {
    return [Planet.Mercury, Planet.Venus, Planet.Earth, Planet.Mars].includes(planet);
  }

  export function isGasGiant(planet: Planet): boolean {
    return [Planet.Jupiter, Planet.Saturn, Planet.Uranus, Planet.Neptune].includes(planet);
  }

  export function getDistanceFromSun(planet: Planet): number {
    const distances = {
      [Planet.Mercury]: 0.39,
      [Planet.Venus]: 0.72,
      [Planet.Earth]: 1.0,
      [Planet.Mars]: 1.52,
      [Planet.Jupiter]: 5.20,
      [Planet.Saturn]: 9.54,
      [Planet.Uranus]: 19.2,
      [Planet.Neptune]: 30.1
    };
    return distances[planet];
  }
}

// Enum iteration
export function getAllColors(): Color[] {
  return Object.values(Color);
}

export function getAllDirections(): Direction[] {
  return Object.values(Direction).filter(value => typeof value === 'number') as Direction[];
}

// Enum guards
export function isValidColor(value: string): value is Color {
  return Object.values(Color).includes(value as Color);
}

export function isValidDirection(value: number): value is Direction {
  return value >= 0 && value <= 3 && Number.isInteger(value);
}

// Complex enum usage
export enum ApiEndpoint {
  Users = "/api/users",
  Posts = "/api/posts",
  Comments = "/api/comments",
  Auth = "/api/auth"
}

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH"
}

export type ApiCall = {
  endpoint: ApiEndpoint;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
};

export const userOperations: Record<string, ApiCall> = {
  listUsers: {
    endpoint: ApiEndpoint.Users,
    method: HttpMethod.GET
  },
  createUser: {
    endpoint: ApiEndpoint.Users,
    method: HttpMethod.POST,
    headers: { "Content-Type": "application/json" }
  },
  updateUser: {
    endpoint: ApiEndpoint.Users,
    method: HttpMethod.PUT,
    headers: { "Content-Type": "application/json" }
  },
  deleteUser: {
    endpoint: ApiEndpoint.Users,
    method: HttpMethod.DELETE
  }
};

// Enum with branded types
export enum Currency {
  USD = "USD",
  EUR = "EUR",
  GBP = "GBP",
  JPY = "JPY"
}

export type Amount<C extends Currency> = {
  value: number;
  currency: C;
};

export type USDAmount = Amount<Currency.USD>;
export type EURAmount = Amount<Currency.EUR>;

// Enum state machine
export enum OrderState {
  Pending = "pending",
  Confirmed = "confirmed",
  Shipped = "shipped",
  Delivered = "delivered",
  Cancelled = "cancelled"
}

export const orderTransitions: Record<OrderState, OrderState[]> = {
  [OrderState.Pending]: [OrderState.Confirmed, OrderState.Cancelled],
  [OrderState.Confirmed]: [OrderState.Shipped, OrderState.Cancelled],
  [OrderState.Shipped]: [OrderState.Delivered],
  [OrderState.Delivered]: [],
  [OrderState.Cancelled]: []
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return orderTransitions[from].includes(to);
}

// Generic enum utilities
export type EnumValues<T extends Record<string, string | number>> = T[keyof T];
export type EnumKeys<T extends Record<string, string | number>> = keyof T;

export function enumToArray<T extends Record<string, string | number>>(
  enumObject: T
): Array<{ key: EnumKeys<T>; value: EnumValues<T> }> {
  return Object.entries(enumObject).map(([key, value]) => ({ key: key as EnumKeys<T>, value: value as EnumValues<T> }));
}

// Usage examples
export const colorArray = enumToArray(Color);
export const statusArray = enumToArray(HttpStatus);

// Const assertions with enums
export const themes = [Theme.Light, Theme.Dark, Theme.Auto] as const;
export type ThemeArray = typeof themes;
export type ThemeValue = ThemeArray[number];