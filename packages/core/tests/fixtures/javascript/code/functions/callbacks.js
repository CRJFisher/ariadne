/**
 * Callback functions and higher-order functions
 * Tests: Function calls through callbacks, higher-order function patterns
 */

// Higher-order function that takes a callback
function processArray(arr, callback) {
  const results = [];
  for (let i = 0; i < arr.length; i++) {
    function callCallback() {
      return callback(arr[i], i);
    }
    results.push(callCallback());
  }
  return results;
}

// Callback functions
function doubleValue(value) {
  return value * 2;
}

function addIndex(value, index) {
  return value + index;
}

// Function that creates and uses callbacks
function createProcessor(operation) {
  function multiply(a, b) {
    return a * b;
  }

  function add(a, b) {
    return a + b;
  }

  function processCallback(data) {
    if (operation === 'multiply') {
      return multiply(data, 2);
    } else if (operation === 'add') {
      return add(data, 10);
    }
    return data;
  }

  return processCallback;
}

// Event-like callback system
function EventEmitter() {
  this.listeners = {};
}

EventEmitter.prototype.on = function(event, callback) {
  if (!this.listeners[event]) {
    this.listeners[event] = [];
  }
  this.listeners[event].push(callback);
};

EventEmitter.prototype.emit = function(event, data) {
  if (this.listeners[event]) {
    function callListener(listener) {
      return listener(data);
    }
    return this.listeners[event].map(callListener);
  }
  return [];
};

// Async-style callbacks
function fetchData(url, callback) {
  // Simulate async operation
  setTimeout(() => {
    function processResult() {
      return { url, data: "fake data" };
    }
    callback(null, processResult());
  }, 0);
}

function handleResult(error, result) {
  if (error) {
    return { success: false, error };
  }
  function formatResult() {
    return { success: true, data: result.data };
  }
  return formatResult();
}

// Using the callback patterns
const numbers = [1, 2, 3, 4];
const doubled = processArray(numbers, doubleValue);
const indexed = processArray(numbers, addIndex);

const multiplier = createProcessor('multiply');
const adder = createProcessor('add');

const multiplyResult = multiplier(5);
const addResult = adder(5);

const emitter = new EventEmitter();

function onDataReceived(data) {
  function logData() {
    return `Received: ${data}`;
  }
  return logData();
}

emitter.on('data', onDataReceived);
const emitResults = emitter.emit('data', 'test message');

// Note: fetchData is async, but we include it for completeness
fetchData('/api/test', handleResult);

export {
  processArray,
  doubleValue,
  addIndex,
  createProcessor,
  EventEmitter,
  fetchData,
  handleResult,
  onDataReceived,
  doubled,
  indexed,
  multiplier,
  adder,
  multiplyResult,
  addResult,
  emitter,
  emitResults,
};
