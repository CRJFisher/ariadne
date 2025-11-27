/**
 * String enum definitions
 * Tests: string enums, enum as type, enum values
 */

// String enum
enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  FATAL = "FATAL",
}

enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

enum Environment {
  DEVELOPMENT = "dev",
  STAGING = "staging",
  PRODUCTION = "prod",
}

// Using string enums
function log(level: LogLevel, message: string): void {
  console.log(`[${level}] ${message}`);
}

function make_request(method: HttpMethod, url: string): Promise<Response> {
  return fetch(url, { method });
}

function get_api_url(env: Environment): string {
  switch (env) {
    case Environment.Development:
      return "http://localhost:3000";
    case Environment.Staging:
      return "https://staging.example.com";
    case Environment.Production:
      return "https://api.example.com";
  }
}

// Const enum (inlined at compile time)
const enum Color {
  RED = "#ff0000",
  GREEN = "#00ff00",
  BLUE = "#0000ff",
}

function get_color_code(color: Color): string {
  return color;
}

export { LogLevel, HttpMethod, Environment, Color, log, make_request, get_api_url, get_color_code };
