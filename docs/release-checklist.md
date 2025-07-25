# AST-Climber Release Checklist

## Before Publishing

1. **Update Version**
   - [ ] Update version in `package.json`
   - [ ] Update version in any documentation that references it

2. **Test Everything**
   - [ ] Run `npm test` and ensure all tests pass
   - [ ] Run `npm run build` successfully
   - [ ] Test the package locally with `npm pack`
   - [ ] Optionally test in a separate project by installing the `.tgz` file

3. **Documentation**
   - [ ] Update README if needed
   - [ ] Update CHANGELOG.md with release notes
   - [ ] Check all documentation links work

4. **Code Quality**
   - [ ] No TypeScript errors
   - [ ] No test failures
   - [ ] No security vulnerabilities (`npm audit`)

## Publishing

### Manual Publishing

1. **NPM Authentication**
   ```bash
   npm login
   ```

2. **Publish**
   ```bash
   npm run publish:npm
   ```
   Or directly:
   ```bash
   npm publish
   ```

### Automated Publishing (GitHub Actions)

1. **Create a GitHub Release**
   - Go to Releases page on GitHub
   - Click "Draft a new release"
   - Create tag: `v0.1.0` (or appropriate version)
   - Release title: `v0.1.0`
   - Add release notes
   - Publish release

2. **GitHub Actions will automatically:**
   - Run tests
   - Build the package
   - Publish to NPM

## After Publishing

1. **Verify Publication**
   - [ ] Check package on npmjs.com: https://www.npmjs.com/package/ast-climber
   - [ ] Test installation: `npm install ast-climber` in a new project
   - [ ] Verify types work correctly in TypeScript

2. **Announcement**
   - [ ] Update any related projects
   - [ ] Notify users of breaking changes (if any)

## Setting up NPM Token for GitHub Actions

1. Generate NPM token:
   - Login to npmjs.com
   - Go to Access Tokens
   - Generate new token (Automation type)

2. Add to GitHub secrets:
   - Go to repository Settings → Secrets → Actions
   - Add new secret: `NPM_TOKEN`
   - Paste the token value