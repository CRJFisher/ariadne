// compiler-cli/src/ngtsc/translator/src/type_translator.ts shape - type_translator.ts

import * as o from "./output_ast";

class TypeTranslatorVisitor implements o.ExpressionVisitor, o.TypeVisitor {
  visitLiteralExpr(ast: unknown, context: unknown): unknown {
    return ast;
  }

  visitBuiltinType(type: o.BuiltinType, context: unknown): unknown {
    return type;
  }
}

export function translate_type(type: o.BuiltinType): unknown {
  return type.visitType(new TypeTranslatorVisitor(), null);
}
