import * as fs from "fs";

const scmPath = "/Users/chuck/workspace/ariadne/packages/core/src/index_single_file/query_code_tree/queries/rust.scm";
const builderPath = "/Users/chuck/workspace/ariadne/packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts";

const scmContent = fs.readFileSync(scmPath, "utf8");
const builderContent = fs.readFileSync(builderPath, "utf8");

// Extract all capture names
const captureMatches = scmContent.matchAll(/@([\w.]+)/g);
const captures = new Set<string>();
for (const match of captureMatches) {
  captures.add(match[1]);
}

// Get definition captures
const definitionCaptures = Array.from(captures)
  .filter(c => c.startsWith("definition."))
  .sort();

console.log("=== HANDLER VERIFICATION FOR DEFINITION.* CAPTURES ===\n");
console.log("Total definition captures:", definitionCaptures.length);
console.log();

const missing: string[] = [];
const present: string[] = [];

console.log("STATUS | CAPTURE NAME");
console.log("-------|-------------");

definitionCaptures.forEach(capture => {
  const hasHandler = builderContent.includes(`"${capture}"`);
  if (hasHandler) {
    console.log("  ✅   | " + capture);
    present.push(capture);
  } else {
    console.log("  ❌   | " + capture);
    missing.push(capture);
  }
});

console.log("\n=== SUMMARY ===");
console.log("Handlers present: " + present.length + "/" + definitionCaptures.length);
console.log("Handlers missing: " + missing.length + "/" + definitionCaptures.length);

if (missing.length > 0) {
  console.log("\n=== MISSING HANDLERS ===");
  missing.forEach(m => console.log("  - " + m));
}

console.log("\n=== REFERENCE CAPTURES (for context) ===");
const referenceCaptures = Array.from(captures)
  .filter(c => c.startsWith("reference."))
  .sort();
console.log("Total reference captures:", referenceCaptures.length);
console.log("(These typically don't need handlers as they're for semantic analysis)");

console.log("\n=== EXPORT CAPTURES (for context) ===");
const exportCaptures = Array.from(captures)
  .filter(c => c.startsWith("export."))
  .sort();
console.log("Total export captures:", exportCaptures.length);
exportCaptures.forEach(cap => {
  const hasHandler = builderContent.includes(`"${cap}"`);
  console.log((hasHandler ? "  ✅" : "  ❌") + "   | " + cap);
});

console.log("\n=== IMPORT CAPTURES (for context) ===");
const importCaptures = Array.from(captures)
  .filter(c => c.startsWith("import."))
  .sort();
console.log("Total import captures:", importCaptures.length);
importCaptures.forEach(cap => {
  const hasHandler = builderContent.includes(`"${cap}"`);
  console.log((hasHandler ? "  ✅" : "  ❌") + "   | " + cap);
});
