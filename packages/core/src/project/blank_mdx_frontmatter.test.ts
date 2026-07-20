import { describe, it, expect } from "vitest";
import { blank_mdx_frontmatter } from "./blank_mdx_frontmatter";

describe("blank_mdx_frontmatter", () => {
  it("replaces a leading frontmatter block with whitespace, preserving newlines", () => {
    const content = "---\na\n---\nX\n";
    expect(blank_mdx_frontmatter(content)).toBe("   \n \n   \nX\n");
  });

  it("preserves total length so downstream locations stay accurate", () => {
    const content = "---\ntitle: Demo\ntags: [a, b]\n---\nimport { Button } from \"./button\";\n";
    const result = blank_mdx_frontmatter(content);

    expect(result.length).toBe(content.length);
    expect(result.endsWith("import { Button } from \"./button\";\n")).toBe(true);
    expect(result.split("\n").length).toBe(content.split("\n").length);
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
});
