# NPM Package Migration Guide: refscope → ast-climber

This guide covers publishing the renamed packages to npm and handling the transition for existing users.

## Prerequisites

- npm account with publish permissions
- NPM_TOKEN configured in GitHub Secrets
- All code changes completed and tested

## Step 1: Publish the New Packages

### 1.1 Publish ast-climber (main package)

```bash
# Ensure you're in the project root
cd /path/to/ast-climber

# Login to npm if not already
npm login

# Run tests to ensure everything works
npm test

# Publish the package
npm publish --access public
```

### 1.2 Publish ast-climber-types

```bash
# Navigate to the types package
cd packages/ast-climber-types

# Run tests
npm test

# Publish the types package
npm publish --access public
```

## Step 2: Update the Old Package (refscope) with Deprecation Notice

### 2.1 Create a Deprecation Release

1. Create a new branch for the deprecation:
```bash
git checkout -b deprecate-refscope
```

2. Update `package.json` in the old refscope package:
```json
{
  "name": "refscope",
  "version": "0.5.7",
  "description": "DEPRECATED: This package has been renamed to ast-climber. Please install ast-climber instead.",
  "main": "index.js",
  "scripts": {
    "postinstall": "node deprecation-notice.js"
  },
  "dependencies": {
    "ast-climber": "^0.5.6"
  }
}
```

3. Create `deprecation-notice.js`:
```javascript
#!/usr/bin/env node

console.log('\n' + '='.repeat(70));
console.log('DEPRECATION NOTICE');
console.log('='.repeat(70));
console.log('\nThe "refscope" package has been renamed to "ast-climber".');
console.log('\nPlease update your dependencies:');
console.log('  npm uninstall refscope');
console.log('  npm install ast-climber');
console.log('\nOr update your package.json:');
console.log('  "refscope": "^0.5.6" → "ast-climber": "^0.5.6"');
console.log('\n' + '='.repeat(70) + '\n');
```

4. Create a minimal `index.js` that re-exports ast-climber:
```javascript
// Re-export everything from ast-climber
module.exports = require('ast-climber');

// Show deprecation warning when imported
console.warn('[DEPRECATION] "refscope" has been renamed to "ast-climber". Please update your imports.');
```

### 2.2 Publish the Deprecation Version

```bash
# Publish the deprecation version
npm publish

# Mark the package as deprecated on npm
npm deprecate refscope@"*" "This package has been renamed to ast-climber. Please install ast-climber instead."
```

## Step 3: Update Documentation and Announcements

### 3.1 Update README on npm

The README will automatically update when you publish, but ensure the old package's README clearly states it's deprecated.

### 3.2 Create GitHub Release Notes

Create a release for the migration:
```markdown
## Migration to ast-climber

This project has been renamed from `refscope` to `ast-climber`. 

### For users:
- Uninstall `refscope`: `npm uninstall refscope`
- Install `ast-climber`: `npm install ast-climber`
- Update imports: `from 'refscope'` → `from 'ast-climber'`

### For TypeScript users:
- The types package is now `ast-climber-types`
- Update your imports accordingly

All functionality remains the same, only the package name has changed.
```

## Step 4: Monitor and Support

### 4.1 Monitor npm Downloads

Keep an eye on:
- https://www.npmjs.com/package/refscope (should decrease)
- https://www.npmjs.com/package/ast-climber (should increase)

### 4.2 Respond to Issues

Be prepared to help users who have issues with the migration:
- Create a FAQ in the repository
- Respond promptly to migration-related issues

## Step 5: Long-term Maintenance

### After 6 months:
1. Check if refscope still has significant downloads
2. Consider removing the deprecation package entirely
3. Update all documentation to remove references to the old name

### After 1 year:
1. Consider unpublishing the old package (if npm allows)
2. Or leave it permanently deprecated as a redirect

## Rollback Plan

If critical issues arise:

1. The old package name is still available
2. You can publish updates to refscope if needed
3. Both packages can coexist during the transition

## FAQ for Users

### Q: Will my existing code break?
A: If you're using the deprecated refscope package, you'll see warnings but your code will continue to work initially. However, you should migrate to ast-climber as soon as possible.

### Q: Do I need to change my code?
A: Only the import statements need to change:
- `import { Project } from 'refscope'` → `import { Project } from 'ast-climber'`
- `require('refscope')` → `require('ast-climber')`

### Q: What about TypeScript types?
A: Install `ast-climber-types` instead of `refscope-types`.

### Q: Why the name change?
A: The new name "ast-climber" better reflects what the library does - it climbs the abstract syntax tree (AST) to find references and definitions in your code.