/**
 * Closures with variable capture
 * Tests: Closures capturing variables from outer scopes, variable access
 */

// Basic closure
function createMultiplier(factor) {
  return function(number) {
    function multiply() {
      return number * factor; // Captures both number and factor
    }
    return multiply();
  };
}

// Closure with multiple captured variables
function createBankAccount(initialBalance, accountName) {
  let balance = initialBalance;
  let transactions = [];

  function addTransaction(type, amount) {
    transactions.push({ type, amount, date: new Date() });
  }

  return {
    deposit(amount) {
      balance += amount;
      addTransaction('deposit', amount);
      return balance;
    },
    withdraw(amount) {
      if (amount <= balance) {
        balance -= amount;
        addTransaction('withdraw', amount);
        return balance;
      }
      return false;
    },
    getBalance() {
      return balance; // Captures balance variable
    },
    getAccountName() {
      return accountName; // Captures accountName parameter
    },
    getTransactionCount() {
      return transactions.length; // Captures transactions array
    }
  };
}

// Nested closures
function createChainedFunction(base) {
  function level1(multiplier) {
    function level2(addition) {
      function calculate() {
        return (base * multiplier) + addition; // Captures all three variables
      }
      return calculate();
    }
    return level2;
  }
  return level1;
}

// Closure in loop (classic closure problem)
function createFunctionArray() {
  const functions = [];

  for (let i = 0; i < 3; i++) {
    functions.push(function() {
      function getValue() {
        return i; // Captures loop variable
      }
      return getValue();
    });
  }

  return functions;
}

// Using the closures
const doubler = createMultiplier(2);
const doubled = doubler(5);

const account = createBankAccount(100, "Savings");
const depositResult = account.deposit(50);
const balanceResult = account.getBalance();
const nameResult = account.getAccountName();

const chainedFn = createChainedFunction(10);
const level2Fn = chainedFn(3);
const chainResult = level2Fn(5);

const fnArray = createFunctionArray();
const arrayResults = fnArray.map(fn => fn());

export {
  createMultiplier,
  createBankAccount,
  createChainedFunction,
  createFunctionArray,
  doubler,
  doubled,
  account,
  depositResult,
  balanceResult,
  nameResult,
  chainResult,
  arrayResults,
};