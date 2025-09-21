/**
 * Language handler registry for import resolution
 *
 * Provides standard language handlers for JavaScript, TypeScript,
 * Python, and Rust import resolution.
 */

import type { Language } from "@ariadnejs/types";
import type { LanguageImportHandler } from "../import_types";
import { create_javascript_handler } from "./javascript";
import { create_python_handler } from "./python";
import { create_rust_handler } from "./rust";

/**
 * Create standard language handlers for all supported languages
 *
 * Returns a map of language to their import resolution handlers.
 * JavaScript and TypeScript share the same handler as they have
 * identical module resolution semantics.
 */
export function create_standard_language_handlers(): Map<Language, LanguageImportHandler> {
  const handlers = new Map<Language, LanguageImportHandler>();

  // JavaScript and TypeScript use the same module resolution
  const js_handler = create_javascript_handler();
  handlers.set("javascript", js_handler);
  handlers.set("typescript", js_handler);

  // Python handler
  handlers.set("python", create_python_handler());

  // Rust handler
  handlers.set("rust", create_rust_handler());

  return handlers;
}

/**
 * Create language handlers with custom configuration
 *
 * Allows customization of language-specific import resolution behavior.
 * Useful for testing or special project configurations.
 */
export function create_language_handlers_with_config(
  config?: {
    javascript?: LanguageImportHandler;
    typescript?: LanguageImportHandler;
    python?: LanguageImportHandler;
    rust?: LanguageImportHandler;
  }
): Map<Language, LanguageImportHandler> {
  const handlers = new Map<Language, LanguageImportHandler>();

  // Use custom or default handlers
  const js_handler = config?.javascript || config?.typescript || create_javascript_handler();
  handlers.set("javascript", config?.javascript || js_handler);
  handlers.set("typescript", config?.typescript || js_handler);

  handlers.set("python", config?.python || create_python_handler());
  handlers.set("rust", config?.rust || create_rust_handler());

  return handlers;
}