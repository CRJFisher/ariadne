import type { Language } from "@ariadnejs/types";
import type { HandlerRegistry } from "./capture_handlers.types";
import { JAVASCRIPT_HANDLERS } from "./capture_handlers.javascript";
import { TYPESCRIPT_HANDLERS } from "./capture_handlers.typescript";
import { PYTHON_HANDLERS } from "./capture_handlers.python";

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

export type { HandlerFunction, HandlerRegistry } from "./capture_handlers.types";
export { JAVASCRIPT_HANDLERS } from "./capture_handlers.javascript";
export { TYPESCRIPT_HANDLERS } from "./capture_handlers.typescript";
export { PYTHON_HANDLERS } from "./capture_handlers.python";
