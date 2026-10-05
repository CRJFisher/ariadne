---
paths:
  - "**/*.md"
---

# Documentation Style: Canonical and Self-Contained

When writing or updating documentation, always write in a **canonical, self-contained** style. Documentation should describe the system as it currently IS, not as it was or how it changed.

**DO:**

- Describe the system as it currently IS
- Write in present tense ("The system works like this...")
- Be authoritative and direct
- Assume reader has no prior knowledge or context
- Focus on WHAT to do, not what NOT to do
- State the approach confidently without justification

**DON'T:**

- Reference "old approaches," "previous versions," or "deprecated methods"
- Use "revised," "updated," or "new" framing
- Explain what you're NOT doing or alternative approaches you rejected
- Include defensive justifications for design choices
- Write comparisons to alternatives (unless teaching concepts)
- Use apologetic or hedging language
- Assume reader knows the history or evolution

**Why:** Documentation should be the authoritative source of truth about the current system. Historical context belongs in commit messages, architecture decision records (separate files), or changelog files - not in the canonical system documentation.

**Note:** This applies to system documentation (README, task docs, architecture docs). Implementation notes in task files may reference history when documenting specific changes made.
