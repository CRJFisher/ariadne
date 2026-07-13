import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode, ProcessingContext } from "../../index_single_file";

type HandlerFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

// Object literal (not Map) to preserve call graph traceability.
export type HandlerRegistry = Readonly<Record<string, HandlerFunction>>;
