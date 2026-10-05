/**
 * MDX files may open with a YAML frontmatter block delimited by `---` lines.
 * The JavaScript grammar cannot parse that block, and its error recovery merges
 * the block with the ESM `import` statement that immediately follows it into a
 * single ERROR node — dropping that import from the index. A component imported
 * on the first line after frontmatter would then never resolve.
 *
 * Blanking the block (replacing every non-newline character with a space while
 * preserving newlines) isolates the frontmatter into whitespace so the grammar
 * recovers cleanly at the first import, and keeps every subsequent line and
 * column at its original position so reference and definition locations stay
 * accurate.
 */
const FRONTMATTER_BLOCK = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

export function blank_mdx_frontmatter(content: string): string {
  const match = content.match(FRONTMATTER_BLOCK);
  if (!match) {
    return content;
  }
  const blanked = match[0].replace(/[^\n\r]/g, " ");
  return blanked + content.slice(match[0].length);
}
