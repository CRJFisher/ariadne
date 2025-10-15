/**
 * Recursive functions
 * Tests: recursive calls, base cases, call graph cycles
 */

function factorial(n: number): number {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

function fibonacci(n: number): number {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

function sumArray(arr: number[]): number {
  if (arr.length === 0) {
    return 0;
  }
  const [first, ...rest] = arr;
  return first + sumArray(rest);
}

// Mutual recursion
function isEven(n: number): boolean {
  if (n === 0) {
    return true;
  }
  return isOdd(n - 1);
}

function isOdd(n: number): boolean {
  if (n === 0) {
    return false;
  }
  return isEven(n - 1);
}

// Tree traversal
interface TreeNode {
  value: number;
  left?: TreeNode;
  right?: TreeNode;
}

function sumTree(node: TreeNode | undefined): number {
  if (!node) {
    return 0;
  }
  return node.value + sumTree(node.left) + sumTree(node.right);
}

export { factorial, fibonacci, sumArray, isEven, isOdd, sumTree };
