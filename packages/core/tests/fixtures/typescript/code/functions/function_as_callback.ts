function apply(callback: (x: number) => number, value: number): number {
  return callback(value);
}

const doubler = (x: number): number => x * 2;

function main(): void {
  const result = apply(doubler, 21);
}
