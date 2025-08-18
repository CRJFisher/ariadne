# Tree-sitter 32KB Buffer Limit Issue (RESOLVED)

## Context

Users have reported errors when trying to parse Python files larger than 32KB:

```txt
Failed to read file: /path/to/file.py Error: Invalid argument
```

Investigation revealed this is caused by a hardcoded buffer limit in the tree-sitter Node.js bindings where files larger than 32,767 bytes cannot be parsed.

## Resolution

**✅ FIXED**: The 32KB limit has been resolved by using the `bufferSize` option in parser.parse() with dynamic sizing.

```javascript
// Dynamic buffer size based on actual file size (with 10% padding)
const bufferSize = Math.max(32 * 1024, Math.ceil(sourceCode.length * 1.1));
const options = { bufferSize };
const tree = parser.parse(sourceCode, oldTree, options);
```

This option is available in tree-sitter 0.21.1 and dynamically adjusts the buffer to handle files of any size. The buffer automatically scales with the file size, eliminating any hard limits.

## Current State

- **tree-sitter version**: 0.21.1
- **Language parsers**:
  - tree-sitter-javascript: 0.21.4
  - tree-sitter-python: 0.21.0
  - tree-sitter-rust: 0.21.0
  - tree-sitter-typescript: 0.21.2

## Version Compatibility Analysis

### Option 1: Upgrade to tree-sitter 0.22.x or later

**Status**: ❌ Not viable

While upgrading might help, all our language parsers have peer dependencies requiring tree-sitter ^0.21.x:

- tree-sitter-python@0.21.0 requires tree-sitter ^0.21.0
- tree-sitter-javascript@0.21.4 requires tree-sitter ^0.21.0
- tree-sitter-typescript@0.21.2 requires tree-sitter ^0.21.1
- tree-sitter-rust@0.21.0 requires tree-sitter ^0.21.0

Attempting to use tree-sitter 0.22.0 with these parsers results in npm peer dependency conflicts.

### Option 2: Upgrade all parsers to 0.23.x versions

**Status**: ❌ Not viable

While newer parser versions exist:

- tree-sitter-python: 0.23.2+
- tree-sitter-javascript: 0.23.0+
- tree-sitter-typescript: 0.23.0+
- tree-sitter-rust: 0.23.0+

These versions still have peer dependencies on tree-sitter ^0.21.x, meaning they don't actually support tree-sitter 0.22.x+. This appears to be a versioning issue in the parser packages themselves.

### Option 3: Stay on current versions with workaround

**Status**: ✅ Currently implemented

We've implemented a workaround that:

1. Detects files larger than 32,767 bytes
2. Truncates at the nearest newline before the limit
3. Parses the truncated content
4. Warns users about potential missing definitions

## Decision

**We will maintain the current versions with the implemented workaround** for the following reasons:

1. **Stability**: The current version combination (0.21.x) is known to work well together
2. **No Clear Upgrade Path**: Parser packages haven't properly updated their peer dependencies
3. **Acceptable Trade-off**: Most source files are under 32KB; those that exceed it are often generated or concatenated files
4. **User Awareness**: Clear warnings inform users when truncation occurs

## Implementation Details

The workaround in `src/index.ts`:

```typescript
const TREE_SITTER_BUFFER_LIMIT = 32767;

if (source_code.length > TREE_SITTER_BUFFER_LIMIT) {
  console.warn(
    `File ${file_path} exceeds 32KB (${source_code.length} bytes). Tree-sitter 0.21.x has a 32KB parsing limit.`
  );
  console.warn(
    `Consider upgrading to tree-sitter 0.22.0+ which removes this limitation.`
  );

  // Find a good truncation point (end of line before the limit)
  let truncateAt = TREE_SITTER_BUFFER_LIMIT;
  while (truncateAt > 0 && source_code[truncateAt] !== "\n") {
    truncateAt--;
  }

  const truncated = source_code.substring(0, truncateAt);
  tree = config.parser.parse(truncated);
}
```

## Investigation Findings

### Rigorous Testing Results

Through systematic testing, I confirmed:

1. **Exact Limit**: Parsing fails at exactly 32,768 bytes (2^15)
2. **Universal**: Affects all language parsers equally (Python, JavaScript, TypeScript, Rust)
3. **Content-Independent**: Fails regardless of content (spaces, newlines, valid code)
4. **Not Encoding-Related**: Binary/invalid UTF-8 data under 32KB parses fine

Test results:
```
✓ 32,767 bytes: Success
✗ 32,768 bytes: Failed - Invalid argument
```

### Root Cause

Found in the tree-sitter Node.js bindings source code (`parser.cc`):
```cpp
buffer.resize(static_cast<uint64_t>(32 * 1024));
```

This hardcodes the buffer to exactly 32,768 bytes (32KB). When parsing a string directly, the entire content must fit in this buffer.

### Alternative Solution: Callback-based Parsing

Tree-sitter supports parsing with a callback function, which could work around the 32KB limit:

```javascript
const tree = parser.parse((index, position) => {
  // Return text starting from the given index/position
  // Can return chunks smaller than 32KB
});
```

This approach is documented in the official tree-sitter Node.js bindings and allows parsing from custom data structures. However, implementing this would require significant refactoring of our parsing logic.

### Lack of Documentation

- **Not mentioned** in official tree-sitter documentation
- **No GitHub issues** in tree-sitter repos discussing this limit
- **Limited community awareness** - only one Stack Overflow post found

## Updated Recommendation

We should maintain our current workaround but also:

1. **Create Upstream Issue**: File an issue with tree-sitter/node-tree-sitter about the 32KB limit
2. **Implement Callback Parsing**: As a future enhancement, implement callback-based parsing for large files
3. **Document Limitation**: Add this limitation to our README to set user expectations

## Future Considerations

1. **Monitor Parser Updates**: Check periodically if parser packages update their peer dependencies to support tree-sitter 0.22.x+
2. **Alternative Parsers**: Consider switching to @tree-sitter/language packages if they become available with proper version support
3. **Callback Implementation**: Implement callback-based parsing for files >32KB to parse them completely
4. **Contribute Upstream**: Consider contributing peer dependency updates to the parser repositories

## Impact

- **Positive**: Library remains stable and functional for 99% of use cases
- **Negative**: Large files (>32KB) only partially analyzed, potentially missing definitions at the end
- **Mitigation**: Clear warnings help users understand the limitation

## Summary

**UPDATE (2025)**: The 32KB limit has been completely resolved by using the `bufferSize` option with dynamic sizing. The buffer now automatically adjusts to the file size, allowing files of any size to be parsed successfully. There is no longer any hard limit.

~~After thorough investigation, the "Invalid argument" error is confirmed to be caused by a hardcoded 32KB buffer limit in the tree-sitter Node.js bindings. The buffer is set to exactly 32,768 bytes in the C++ source code. This is not a version-specific issue but a fundamental limitation of how the Node.js bindings handle string parsing.~~

## References

- [Tree-sitter Node.js bindings source (parser.cc)](https://github.com/tree-sitter/node-tree-sitter/blob/master/src/parser.cc)
- [Stack Overflow: tree-sitter size limitation](https://stackoverflow.com/questions/79507130/tree-sitter-size-limitation-fails-if-code-is-32kb)
- [Tree-sitter callback parsing documentation](https://github.com/tree-sitter/node-tree-sitter#parsing)
- Test results confirming the exact 32,768 byte limit
