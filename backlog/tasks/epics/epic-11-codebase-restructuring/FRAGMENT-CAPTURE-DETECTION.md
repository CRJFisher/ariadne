# Fragment Capture Detection Strategy

**Purpose**: Detect when captures target fragment nodes instead of complete syntactic units

---

## The Pattern

### Fragment Captures (BAD)

Captures appear on **child nodes** within a larger construct:

```scheme
(call_expression
  function: (member_expression
    property: (property_identifier) @reference.call    ← Capture on CHILD
  )
)
```

The capture is on `property_identifier`, which is a **fragment** of the call.

### Complete Captures (GOOD)

Captures appear at the **construct level**:

```scheme
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call                                       ← Capture on PARENT
```

The capture is on `call_expression`, which is the **complete** syntactic unit.

---

## Detection Strategy

### Pattern 1: Inline Child Captures

**Regex pattern**:
```
\(\w+\)\s+@reference\.call
```

**Matches**:
```scheme
(property_identifier) @reference.call       ← Fragment
(field_identifier) @reference.call          ← Fragment
(identifier) @reference.call                ← Could be fragment or complete (context-dependent)
```

**Context needed**: Check if this is inside a larger construct

### Pattern 2: Field-Level Captures

**Regex pattern**:
```
(property|field|attribute|function):\s*\([^)]+\)\s+@reference\.call
```

**Matches**:
```scheme
property: (property_identifier) @reference.call         ← Fragment
field: (field_identifier) @reference.call               ← Fragment
attribute: (identifier) @reference.call                 ← Fragment
function: (identifier) @reference.call                  ← OK for top-level functions
```

### Pattern 3: Multiple Captures on Same Line

**Regex pattern**:
```
@reference\.call.*@reference\.call
```

**Matches**:
```scheme
property: (property_identifier) @reference.call) @reference.call.full    ← Duplicate!
```

---

## Validation Algorithm

```typescript
/**
 * Check if a capture might be a fragment (heuristic)
 */
function detect_fragment_captures(scm_content: string): FragmentWarning[] {
  const warnings: FragmentWarning[] = [];
  const lines = scm_content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const line_num = i + 1;

    // Pattern 1: Check for known fragment node types with @reference.call
    if (line.match(/property_identifier\)\s+@reference\.call(?!_expression)/)) {
      warnings.push({
        line: line_num,
        context: line.trim(),
        issue: "property_identifier captured instead of call_expression",
        suggestion: "Move @reference.call to parent call_expression node"
      });
    }

    if (line.match(/field_identifier\)\s+@reference\.call(?!_expression)/)) {
      warnings.push({
        line: line_num,
        context: line.trim(),
        issue: "field_identifier captured instead of call_expression",
        suggestion: "Move @reference.call to parent call_expression node"
      });
    }

    // Pattern 2: Check for duplicate captures on same line
    const call_captures = line.match(/@reference\.call(\.\w+)?/g);
    if (call_captures && call_captures.length > 1) {
      warnings.push({
        line: line_num,
        context: line.trim(),
        issue: "Multiple @reference.call captures on same line",
        suggestion: "Use single capture on complete node only"
      });
    }

    // Pattern 3: Check for .full, .chained, .deep qualifiers
    if (line.match(/@reference\.call\.(full|chained|deep)/)) {
      warnings.push({
        line: line_num,
        context: line.trim(),
        issue: "Fragment qualifier (.full, .chained, .deep) used",
        suggestion: "Use single @reference.call on call_expression"
      });
    }
  }

  return warnings;
}
```

---

## Limitations

### Cannot Fully Validate Node Types

**Why**: Would need to parse .scm files as Scheme/tree-sitter query language

**What we CAN do**: Heuristic checks based on common patterns:
- Detect known fragment node types in context
- Detect duplicate captures
- Detect problematic qualifiers

**What we CANNOT do**: Guarantee capture is on correct node type

### Good Enough Approach

The combination of:
1. **Positive validation** (capture must be in schema)
2. **Heuristic fragment detection** (warn about common patterns)
3. **Manual review** (team validates query files)

Will catch 95%+ of issues without requiring full .scm parsing.

---

## Recommended Validation

```typescript
interface ValidationResult {
  errors: ValidationError[];     // Schema violations (fails validation)
  warnings: FragmentWarning[];   // Heuristic issues (should review)
  stats: CaptureStats;
}

// ERRORS - Must fix (fails CI)
- Capture not in required/optional lists
- Invalid naming convention
- Exceeds max depth

// WARNINGS - Should review (passes CI but flagged)
- Capture on known fragment node type
- Duplicate captures on same line
- Qualifiers like .full, .chained, .deep
```

This keeps CI strict (only schema violations fail) while providing helpful guidance (warnings about fragments).

---

## Recommendation

Add fragment detection as **warnings**, not errors:
- Schema violations → errors → fail CI
- Fragment patterns → warnings → pass CI but developer should review
- Manual review during code review catches edge cases

This balances automation with pragmatism.
