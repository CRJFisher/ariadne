import type { Language } from "@ariadnejs/types";
import type { HandlerRegistry } from "./types";
import { JAVASCRIPT_HANDLERS } from "./javascript";

export function get_handler_registry(language: Language): HandlerRegistry {
  switch (language) {
    case "javascript":
    case "typescript":
      return JAVASCRIPT_HANDLERS;
    default:
      throw new Error(`Handler registry not yet implemented for ${language}`);
  }
}

export type { HandlerFunction, HandlerRegistry } from "./types";
export { JAVASCRIPT_HANDLERS } from "./javascript";
