---
hooks:
  Stop:
    - hooks:
        - type: command
          command: "pnpm exec tsx \"$CLAUDE_PROJECT_DIR/.claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts\""
          timeout: 30
---

# Self-Repair Pipeline

Triage pipeline for entrypoint analysis false positive detection.
