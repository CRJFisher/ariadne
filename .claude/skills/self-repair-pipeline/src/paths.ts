import path from "path";
import { fileURLToPath } from "url";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const STATE_DIR = path.resolve(SKILL_DIR, "../../self-repair-pipeline-state");

export const REGISTRY_DIR = path.join(STATE_DIR, "known_entrypoints");
export const ANALYSIS_OUTPUT_DIR = path.join(STATE_DIR, "analysis_output");
export const TRIAGE_STATE_DIR = path.join(STATE_DIR, "triage_state");
export const TRIAGE_PATTERNS_FILE = path.join(STATE_DIR, "triage_patterns.json");
