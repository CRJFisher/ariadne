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

function sum_array(arr: number[]): number {
  if (arr.length === 0) {
    return 0;
  }
  const [first, ...rest] = arr;
  return first + sum_array(rest);
}

// Mutual recursion
function is_even(n: number): boolean {
  if (n === 0) {
    return true;
  }
  return is_odd(n - 1);
}

function is_odd(n: number): boolean {
  if (n === 0) {
    return false;
  }
  return is_even(n - 1);
}

// Tree traversal
interface TreeNode {
  value: number;
  left?: TreeNode;
  right?: TreeNode;
}

function sum_tree(node: TreeNode | undefined): number {
  if (!node) {
    return 0;
  }
  return node.value + sum_tree(node.left) + sum_tree(node.right);
}

export { factorial, fibonacci, sum_array, is_even, is_odd, sum_tree };
