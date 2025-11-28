import type { Language } from "@ariadnejs/types";
import type { HandlerRegistry } from "./types";

export function get_handler_registry(_language: Language): HandlerRegistry {
  // Placeholder - will be implemented as handlers are migrated
  throw new Error(`Handler registry not yet implemented for ${_language}`);
}

export type { HandlerFunction, HandlerRegistry } from "./types";
