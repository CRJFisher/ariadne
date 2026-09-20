import Parser from "tree-sitter";
import { LANGUAGE_TO_TREESITTER_LANG } from "./src/index_single_file/query_code_tree/parsers";
const p = new Parser();
p.setLanguage(LANGUAGE_TO_TREESITTER_LANG.get("typescript")!);
const t = p.parse(`const routers: Array<Router> = [];
let single: Router = new Router();
for (const x: Router of xs) {}
`);
const walk = (n: any, d = 0) => {
  console.log(" ".repeat(d) + n.type + "  [" + JSON.stringify(n.text.slice(0, 40)) + "]");
  for (const c of n.children) walk(c, d + 2);
};
walk(t.rootNode);
