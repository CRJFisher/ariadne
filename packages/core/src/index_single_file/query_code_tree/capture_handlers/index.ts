import type { Language } from "@ariadnejs/types";
import type { HandlerRegistry } from "./types";
import { JAVASCRIPT_HANDLERS } from "./javascript";
import { TYPESCRIPT_HANDLERS } from "./typescript";
import { PYTHON_HANDLERS } from "./python";

export function get_handler_registry(language: Language): HandlerRegistry {
  switch (language) {
    case "javascript":
      return JAVASCRIPT_HANDLERS;
    case "typescript":
      return TYPESCRIPT_HANDLERS;
    case "python":
      return PYTHON_HANDLERS;
    default:
      throw new Error(`Handler registry not yet implemented for ${language}`);
  }
}

export type { HandlerFunction, HandlerRegistry } from "./types";
export { JAVASCRIPT_HANDLERS } from "./javascript";
export { TYPESCRIPT_HANDLERS } from "./typescript";
export { PYTHON_HANDLERS } from "./python";
