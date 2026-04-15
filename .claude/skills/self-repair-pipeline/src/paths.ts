import os from "os";
import path from "path";

export const STATE_DIR = path.join(os.homedir(), ".ariadne", "self-repair-pipeline");

export const PROJECT_CONFIGS_DIR = path.join(STATE_DIR, "project_configs");
export const REGISTRY_DIR = path.join(STATE_DIR, "known_entrypoints");
export const ANALYSIS_OUTPUT_DIR = path.join(STATE_DIR, "analysis_output");
export const TRIAGE_STATE_DIR = path.join(STATE_DIR, "triage_state");
