import { describe, it, expect } from "vitest";
import { blank_mdx_frontmatter } from "./blank_mdx_frontmatter";

describe("blank_mdx_frontmatter", () => {
  it("replaces a leading frontmatter block with whitespace, preserving newlines", () => {
    const content = "---\na\n---\nX\n";
    expect(blank_mdx_frontmatter(content)).toBe("   \n \n   \nX\n");
  });

  it("preserves total length so downstream locations stay accurate", () => {
    const content = "---\ntitle: Demo\ntags: [a, b]\n---\nimport { Button } from \"./button\";\n";
    // Each blanked frontmatter line keeps its original length as spaces, so the
    // import line below the block sits at its original row and column.
    const expected =
      " ".repeat("---".length) + "\n" +
      " ".repeat("title: Demo".length) + "\n" +
      " ".repeat("tags: [a, b]".length) + "\n" +
      " ".repeat("---".length) + "\n" +
      "import { Button } from \"./button\";\n";

    expect(blank_mdx_frontmatter(content)).toBe(expected);
    expect(expected.length).toBe(content.length);
  });

  it("leaves content without frontmatter unchanged", () => {
    const content = "import { Button } from \"./button\";\n\n<Button />\n";
    expect(blank_mdx_frontmatter(content)).toBe(content);
  });

  it("does not treat a horizontal rule below the first line as frontmatter", () => {
    const content = "# Heading\n\n---\n\nmore text\n";
    expect(blank_mdx_frontmatter(content)).toBe(content);
  });

  it("blanks a CRLF frontmatter block preserving carriage returns and newlines", () => {
    const content = "---\r\na\r\n---\r\nX\r\n";
    expect(blank_mdx_frontmatter(content)).toBe("   \r\n \r\n   \r\nX\r\n");
  });

  it("blanks a frontmatter block that closes at end of file with no trailing newline", () => {
    const content = "---\na\n---";
    expect(blank_mdx_frontmatter(content)).toBe("   \n \n   ");
  });
});
