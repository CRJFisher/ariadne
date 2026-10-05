// compiler-cli/src/ngtsc/translator/src/translator.ts shape - translator.ts

import * as o from "./output_ast";

export class ExpressionTranslatorVisitor<TFile, TStatement, TExpression>
  implements o.ExpressionVisitor, o.TypeVisitor
{
  visitLiteralExpr(ast: unknown, context: unknown): TExpression | undefined {
    return undefined;
  }

  visitBuiltinType(type: o.BuiltinType, context: unknown): TStatement | TFile | undefined {
    return undefined;
  }
}
