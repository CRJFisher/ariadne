/**
 * Various import patterns
 * Tests: named imports, default imports, namespace imports
 */

// Named imports
import { API_URL, API_VERSION, formatDate } from "./exports";

// Default import
import Application from "./exports";

// Mixed imports
import DefaultExport, { HttpClient, Config } from "./exports";

// Namespace import
import * as Exports from "./exports";

// Type-only imports
import type { RequestMethod } from "./exports";

// Using imported values
function createApplication(): Application {
  const config: Config = {
    apiUrl: API_URL,
    timeout: 5000,
    retries: 3,
  };

  return new Application(config);
}

function getCurrentTimestamp(): string {
  return formatDate(new Date());
}

function makeClient(): HttpClient {
  return new HttpClient(API_URL);
}

// Using namespace import
function getVersion(): string {
  return `${Exports.API_URL}/${Exports.API_VERSION}`;
}

export { createApplication, getCurrentTimestamp, makeClient, getVersion };
