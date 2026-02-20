// @ts-nocheck
// Comprehensive enum testing

// Basic string enum
export enum Color {
  RED = "red",
  GREEN = "green",
  BLUE = "blue",
  YELLOW = "yellow",
  PURPLE = "purple"
}

// Basic numeric enum
export enum Direction {
  UP,    // 0
  DOWN,  // 1
  LEFT,  // 2
  RIGHT  // 3
}

// Enum with explicit numeric values
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500
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
  NONE = 0,
  READ = 1 << 1,      // 2
  WRITE = 1 << 2,     // 4
  EXECUTE = 1 << 3,   // 8
  READ_WRITE = Read | Write,                    // 6
  READ_EXECUTE = Read | Execute,                // 10
  WRITE_EXECUTE = Write | Execute,              // 12
  ALL = Read | Write | Execute                 // 14
}

// Const enum (compile-time optimization)
export const enum Theme {
  LIGHT = "light",
  DARK = "dark",
  AUTO = "auto"
}

// Ambient enum (declare)
declare enum ExternalEnum {
  VALUE1,
  VALUE2,
  VALUE3
}

// Reverse mapping demonstration
export enum LogLevel {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
  DEBUG = 3
}

// Functions using enums
export function get_color_hex(color: Color): string {
  switch (color) {
  case Color.RED:
    return "#FF0000";
  case Color.GREEN:
    return "#00FF00";
  case Color.BLUE:
    return "#0000FF";
  case Color.YELLOW:
    return "#FFFF00";
  case Color.PURPLE:
    return "#800080";
  default:
    return "#000000";
  }
}

export function is_success_status(status: HttpStatus): boolean {
  return status >= HttpStatus.OK && status < 300;
}

export function can_access(required: FileAccess, available: FileAccess): boolean {
  return (available & required) === required;
}

// Enum as object keys
export type ColorSettings = {
  [key in Color]: {
    hex: string;
    rgb: [number, number, number];
  };
};

export const color_config: ColorSettings = {
  [Color.RED]: { hex: "#FF0000", rgb: [255, 0, 0] },
  [Color.GREEN]: { hex: "#00FF00", rgb: [0, 255, 0] },
  [Color.BLUE]: { hex: "#0000FF", rgb: [0, 0, 255] },
  [Color.YELLOW]: { hex: "#FFFF00", rgb: [255, 255, 0] },
  [Color.PURPLE]: { hex: "#800080", rgb: [128, 0, 128] },
};

// Enum with methods (via namespace merging)
export enum Planet {
  MERCURY = "mercury",
  VENUS = "venus",
  EARTH = "earth",
  MARS = "mars",
  JUPITER = "jupiter",
  SATURN = "saturn",
  URANUS = "uranus",
  NEPTUNE = "neptune"
}

export namespace Planet {
  export function is_terrestrial(planet: Planet): boolean {
    return [Planet.MERCURY, Planet.VENUS, Planet.EARTH, Planet.MARS].includes(planet);
  }

  export function is_gas_giant(planet: Planet): boolean {
    return [Planet.JUPITER, Planet.SATURN, Planet.URANUS, Planet.NEPTUNE].includes(planet);
  }

  export function get_distance_from_sun(planet: Planet): number {
    const distances = {
      [Planet.MERCURY]: 0.39,
      [Planet.VENUS]: 0.72,
      [Planet.EARTH]: 1.0,
      [Planet.MARS]: 1.52,
      [Planet.JUPITER]: 5.20,
      [Planet.SATURN]: 9.54,
      [Planet.URANUS]: 19.2,
      [Planet.NEPTUNE]: 30.1,
    };
    return distances[planet];
  }
}

// Enum iteration
export function get_all_colors(): Color[] {
  return Object.values(Color);
}

export function get_all_directions(): Direction[] {
  return Object.values(Direction).filter(value => typeof value === "number") as Direction[];
}

// Enum guards
export function is_valid_color(value: string): value is Color {
  return Object.values(Color).includes(value as Color);
}

export function is_valid_direction(value: number): value is Direction {
  return value >= 0 && value <= 3 && Number.isInteger(value);
}

// Complex enum usage
export enum ApiEndpoint {
  USERS = "/api/users",
  POSTS = "/api/posts",
  COMMENTS = "/api/comments",
  AUTH = "/api/auth"
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

export const user_operations: Record<string, ApiCall> = {
  listUsers: {
    endpoint: ApiEndpoint.USERS,
    method: HttpMethod.GET,
  },
  createUser: {
    endpoint: ApiEndpoint.USERS,
    method: HttpMethod.POST,
    headers: { "Content-Type": "application/json" },
  },
  updateUser: {
    endpoint: ApiEndpoint.USERS,
    method: HttpMethod.PUT,
    headers: { "Content-Type": "application/json" },
  },
  deleteUser: {
    endpoint: ApiEndpoint.USERS,
    method: HttpMethod.DELETE,
  },
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
  PENDING = "pending",
  CONFIRMED = "confirmed",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled"
}

export const order_transitions: Record<OrderState, OrderState[]> = {
  [OrderState.PENDING]: [OrderState.CONFIRMED, OrderState.CANCELLED],
  [OrderState.CONFIRMED]: [OrderState.SHIPPED, OrderState.CANCELLED],
  [OrderState.SHIPPED]: [OrderState.DELIVERED],
  [OrderState.DELIVERED]: [],
  [OrderState.CANCELLED]: [],
};

export function can_transition(from: OrderState, to: OrderState): boolean {
  return order_transitions[from].includes(to);
}

// Generic enum utilities
export type EnumValues<T extends Record<string, string | number>> = T[keyof T];
export type EnumKeys<T extends Record<string, string | number>> = keyof T;

export function enum_to_array<T extends Record<string, string | number>>(
  enum_object: T,
): Array<{ key: EnumKeys<T>; value: EnumValues<T> }> {
  return Object.entries(enum_object).map(([key, value]) => ({ key: key as EnumKeys<T>, value: value as EnumValues<T> }));
}

// Usage examples
export const color_array = enum_to_array(Color);
export const status_array = enum_to_array(HttpStatus);

// Const assertions with enums
export const themes = [Theme.LIGHT, Theme.DARK, Theme.AUTO] as const;
export type ThemeArray = typeof themes;
export type ThemeValue = ThemeArray[number];