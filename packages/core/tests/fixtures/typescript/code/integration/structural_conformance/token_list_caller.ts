// The caller: a two-member interface must not fan out to the carriers - token_list_caller.ts

import { RDomTokenList } from "./token_list";

export function classify(tokens: RDomTokenList, token: string): void {
  tokens.add(token);
}
