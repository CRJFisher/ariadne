import { Location } from "./common";

export type AnalysisPhase =
  | "parsing"
  | "scope_analysis"
  | "import_resolution"
  | "export_detection"
  | "type_tracking"
  | "call_graph"
  | "class_detection"
  | "return_type_inference";

export interface AnalysisError {
  readonly message: string;
  readonly location?: Location;
  readonly phase: AnalysisPhase;
  readonly severity: "error" | "warning" | "info";
}
