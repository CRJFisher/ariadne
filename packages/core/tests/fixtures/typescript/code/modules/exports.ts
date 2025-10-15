/**
 * Various export patterns
 * Tests: named exports, default exports, export declarations
 */

// Named export - inline
export const API_URL = "https://api.example.com";
export const API_VERSION = "v1";

// Named export - function
export function formatDate(date: Date): string {
  return date.toISOString();
}

// Named export - class
export class HttpClient {
  constructor(private baseUrl: string) {}

  async get(path: string): Promise<any> {
    return fetch(`${this.baseUrl}${path}`);
  }
}

// Named export - interface
export interface Config {
  apiUrl: string;
  timeout: number;
  retries: number;
}

// Named export - type
export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE";

// Regular declarations
const SECRET_KEY = "secret";
const DEBUG = false;

function validateConfig(config: Config): boolean {
  return config.timeout > 0 && config.retries >= 0;
}

class Logger {
  log(message: string): void {
    console.log(message);
  }
}

// Export list
export { SECRET_KEY, DEBUG, validateConfig, Logger };

// Default export
export default class Application {
  constructor(private config: Config) {}

  start(): void {
    console.log("Application started");
  }
}
