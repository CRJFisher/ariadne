import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";

type HandlerFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

// Object literal (not Map) to preserve call graph traceability.
export type HandlerRegistry = Readonly<Record<string, HandlerFunction>>;
