/**
 * String enum definitions
 * Tests: string enums, enum as type, enum values
 */

// String enum
enum LogLevel {
  Debug = "DEBUG",
  Info = "INFO",
  Warning = "WARNING",
  Error = "ERROR",
  Fatal = "FATAL",
}

enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
  Patch = "PATCH",
}

enum Environment {
  Development = "dev",
  Staging = "staging",
  Production = "prod",
}

// Using string enums
function log(level: LogLevel, message: string): void {
  console.log(`[${level}] ${message}`);
}

function makeRequest(method: HttpMethod, url: string): Promise<Response> {
  return fetch(url, { method });
}

function getApiUrl(env: Environment): string {
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
  Red = "#ff0000",
  Green = "#00ff00",
  Blue = "#0000ff",
}

function getColorCode(color: Color): string {
  return color;
}

export { LogLevel, HttpMethod, Environment, Color, log, makeRequest, getApiUrl, getColorCode };
