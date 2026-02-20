function apply(callback, value) {
  return callback(value);
}

const doubler = (x) => x * 2;

function main() {
  const result = apply(doubler, 21);
}
