# Task 11.106.1: Evaluate Context Attributes for Method Resolution

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 45 minutes
**Parent:** task-epic-11.106
**Dependencies:** None

## Objective

Determine which `ReferenceContext` attributes are essential for method call resolution by evaluating each against two criteria:
1. Can it be extracted via tree-sitter queries?
2. Does it serve method call resolution (receiver type detection)?

**Approach:** Blinkered - design from first principles, not from existing code usage.

## Attributes to Evaluate

### ReferenceContext Attributes

| Attribute | Purpose | Tree-sitter Extractable? | Method Resolution Need? |
|-----------|---------|------------------------|----------------------|
| `receiver_location` | Identify receiver object | ✅ Parent node | ✅ Essential |
| `property_chain` | Track chained access | ✅ Member expressions | ✅ Essential |
| `containing_function` | Function scope | ⚠️ Scope traversal | ❌ No |
| `assignment_source` | Where value comes from | ✅ Assignment nodes | ⚠️ Evaluate |
| `assignment_target` | Where value goes to | ✅ Assignment nodes | ⚠️ Evaluate |
| `construct_target` | Constructor type | ✅ New expression | ⚠️ Evaluate |

## Evaluation Questions

For each attribute, answer:

1. **Tree-sitter query:** What AST pattern captures this?
2. **Method resolution:** How does this help resolve `obj.method()`?
3. **Keep/Remove:** Based on answers to 1 & 2

### receiver_location
- **Query:** Parent member_expression or call_expression receiver node
- **Resolution:** Identifies the object whose type we need
- **Decision:** **KEEP** - Essential

### property_chain
- **Query:** Sequence of property_identifier nodes in member chain
- **Resolution:** For `a.b.c.method()`, captures the path to resolve
- **Decision:** **KEEP** - Essential

### containing_function
- **Query:** Requires walking up scope tree (not AST-local)
- **Resolution:** Doesn't help identify receiver type
- **Decision:** **REMOVE** - Not needed for method resolution

### assignment_source
- **Query:** Right-hand side of assignment
- **Resolution:** Could trace where receiver came from, but...
  - Requires following the reference
  - Not AST-local
  - Doesn't directly give us receiver type
- **Decision:** **EVALUATE** - Probably not needed

### assignment_target
- **Query:** Left-hand side of assignment
- **Resolution:** Similar to source, doesn't directly help
- **Decision:** **EVALUATE** - Probably not needed

### construct_target
- **Query:** Identifier in `new TypeName()`
- **Resolution:** Could indicate constructor type, but...
  - Constructor type comes from type_info already
  - Redundant with existing type extraction
- **Decision:** **EVALUATE** - May be redundant

## Deliverable

Decision matrix:

```markdown
## ReferenceContext Attribute Decisions

### KEEP (Essential for Method Resolution)
- `receiver_location` - Identifies receiver object
- `property_chain` - Tracks access chains

### REMOVE (Not Needed for Method Resolution)
- `containing_function` - Doesn't help identify receiver type

### EVALUATE (Unclear Benefit)
- `assignment_source` - [Decision after evaluation]
- `assignment_target` - [Decision after evaluation]
- `construct_target` - [Decision after evaluation]
```

## Success Criteria

- ✅ Every attribute evaluated against both criteria
- ✅ Tree-sitter query pattern identified for each kept attribute
- ✅ Method resolution use case documented for each kept attribute
- ✅ Clear KEEP/REMOVE decision for all attributes
- ✅ Minimal interface (remove anything not clearly essential)

## Notes

**Blinkered approach:** Don't check existing code usage. Design based on:
1. What tree-sitter can capture
2. What method resolution needs

**Method resolution focus:** Ask "does this help resolve `obj.method()` calls?" If unclear → Remove it (can always add back if truly needed later).
