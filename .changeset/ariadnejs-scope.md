---
"@ariadnejs/core": patch
"@ariadnejs/types": patch
---

Changed npm package scope from `@ariadne/*` to `@ariadnejs/*`

Due to the `@ariadne` organization already being taken on npm, we've changed our package scope to `@ariadnejs`. Update your imports:

**Before:**
```json
{
  "dependencies": {
    "@ariadne/core": "^0.5.9",
    "@ariadne/types": "^0.5.9"
  }
}
```

**After:**
```json
{
  "dependencies": {
    "@ariadnejs/core": "^1.0.0",
    "@ariadnejs/types": "^1.0.0"
  }
}
```

```typescript
// Before
import { Definition } from '@ariadne/types';
import { RefScope } from '@ariadne/core';

// After
import { Definition } from '@ariadnejs/types';
import { RefScope } from '@ariadnejs/core';
```