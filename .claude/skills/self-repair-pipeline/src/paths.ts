import os from "os";
import path from "path";

export const STATE_DIR = path.join(os.homedir(), ".ariadne", "self-repair-pipeline");

export const REGISTRY_DIR = path.join(STATE_DIR, "known_entrypoints");
export const ANALYSIS_OUTPUT_DIR = path.join(STATE_DIR, "analysis_output");
export const TRIAGE_STATE_DIR = path.join(STATE_DIR, "triage_state");
export const TRIAGE_PATTERNS_FILE = path.join(STATE_DIR, "triage_patterns.json");
