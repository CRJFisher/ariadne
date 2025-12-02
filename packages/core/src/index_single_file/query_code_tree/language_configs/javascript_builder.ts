/**
 * JavaScript/TypeScript language configuration types
 *
 * Contains type definitions used by the builder configuration.
 * Symbol factories and helper functions are in symbol_factories/symbol_factories.javascript.ts
 */

import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../semantic_index";
import type { ProcessingContext } from "../../semantic_index";

export type ProcessFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

export type LanguageBuilderConfig = Map<string, { process: ProcessFunction }>;
