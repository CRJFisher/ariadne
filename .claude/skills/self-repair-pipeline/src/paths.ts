import os from "os";
import path from "path";

const STATE_DIR = path.join(os.homedir(), ".ariadne", "self-repair-pipeline");

export const ANALYSIS_OUTPUT_DIR = path.join(STATE_DIR, "analysis_output");
export const TRIAGE_STATE_DIR = path.join(STATE_DIR, "triage_state");
