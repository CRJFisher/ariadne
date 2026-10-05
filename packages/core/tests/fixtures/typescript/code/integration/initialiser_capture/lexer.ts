// packages/compiler/src/ml_parser/lexer.ts shape - lexer.ts

class PlainCharacterCursor {
  peek(): number {
    return 0;
  }
}

class _Tokenizer {
  constructor(private _cursor: PlainCharacterCursor, private _options: string) {}

  tokenize(): void {}
}

export function tokenize(options: string): void {
  const tokenizer = new _Tokenizer(new PlainCharacterCursor(), options);
  tokenizer.tokenize();
}
