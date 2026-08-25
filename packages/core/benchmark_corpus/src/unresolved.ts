export function parse_payload(raw: string): unknown {
  return JSON.parse(raw);
}

export function report(message: string): void {
  console.log(message);
}
