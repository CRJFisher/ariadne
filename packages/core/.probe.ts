import Parser from "tree-sitter";
import { LANGUAGE_TO_TREESITTER_LANG } from "./src/index_single_file/query_code_tree/parsers";
import { build_index_single_file } from "./src/index_single_file/index_single_file";

function index(code: string, lang: any, file: string) {
  const parser = new Parser();
  parser.setLanguage(LANGUAGE_TO_TREESITTER_LANG.get(lang)!);
  const tree = parser.parse(code);
  const lines = code.split("\n");
  return build_index_single_file(
    { file_path: file as any, file_lines: lines.length, file_end_column: lines[lines.length - 1]?.length ?? 0, tree, lang, source: code },
    tree,
    lang
  );
}
const show = (label: string, r: any) => {
  const vs = Array.from((r.variables ?? []).values ? (r.variables as any).values() : r.variables); console.log(label, JSON.stringify(vs.map((v: any) => ({ n: v.name, k: v.kind, t: v.type })))); };

show("TS:", index(`
class Router {}
const routers: Array<Router> = [];
let single: Router = new Router();
`, "typescript", "a.ts"));

show("RS:", index(`
struct Router {}
fn main() {
  let r: Vec<Router> = Vec::new();
  let s: Router = Router{};
}
const C: u32 = 3;
`, "rust", "a.rs"));

show("PY:", index(`
class Router: pass
routers: list[Router] = []
single: Router = Router()
`, "python", "a.py"));
