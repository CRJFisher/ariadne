// Class-object carriers - parsers.ts

export class Parser {
  source: string;

  constructor(source: string) {
    this.source = source;
  }

  parse(): string {
    return this.source;
  }
}

export class Lexer {
  tokenize(): string[] {
    return [];
  }
}

function lexer_class(): typeof Lexer {
  return Lexer;
}

export function parse_aliased(source: string): string {
  const cls = Parser;
  const p = new cls(source);
  return p.parse();
}

export function tokenize_factory(): string[] {
  const lexer_cls = lexer_class();
  const lexer = new lexer_cls();
  return lexer.tokenize();
}
