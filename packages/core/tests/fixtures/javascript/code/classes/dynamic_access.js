/**
 * Dynamic property and method access
 * Tests: Bracket notation method calls, computed property access
 */

class ServiceManager {
  constructor() {
    this.services = {};
  }

  registerService(name, service) {
    this.services[name] = service;
  }

  getService(name) {
    return this.services[name];
  }

  callMethod(serviceName, methodName, ...args) {
    const service = this.getService(serviceName);
    if (service && typeof service[methodName] === 'function') {
      function callDynamicMethod() {
        return service[methodName](...args);
      }
      return callDynamicMethod();
    }
    return null;
  }
}

// Service object with methods for dynamic access
const mathService = {
  add(a, b) {
    return a + b;
  },

  multiply(a, b) {
    return a * b;
  },

  calculate(operation, a, b) {
    function getOperationMethod() {
      return this[operation]; // Dynamic method access
    }

    const method = getOperationMethod.call(this);
    if (typeof method === 'function') {
      return method(a, b);
    }
    return null;
  }
};

// Object with computed method names
const dynamicMethods = {
  data: { value: 42 },

  // Methods accessed via computed properties
  getValue() {
    return this.data.value;
  },

  setValue(newValue) {
    this.data.value = newValue;
  },

  performOperation(operation, operand) {
    const methodName = `${operation}Value`;

    function executeMethod() {
      if (operation === 'get') {
        return this.getValue();
      } else if (operation === 'set') {
        return this.setValue(operand);
      }
    }

    return executeMethod.call(this);
  }
};

// Function that uses dynamic method calls
function invokeMethod(obj, methodName, ...args) {
  function callMethodDynamically() {
    return obj[methodName](...args);
  }

  if (typeof obj[methodName] === 'function') {
    return callMethodDynamically();
  }
  return undefined;
}

// Using dynamic access patterns
const manager = new ServiceManager();
manager.registerService('math', mathService);

// Dynamic method calls through bracket notation
const addResult = manager.callMethod('math', 'add', 5, 3);
const multiplyResult = manager.callMethod('math', 'multiply', 4, 7);

// Dynamic method access within object
const calcResult1 = mathService.calculate('add', 10, 20);
const calcResult2 = mathService.calculate('multiply', 6, 8);

// Computed property method calls
const getValue1 = dynamicMethods.performOperation('get');
const setValue1 = dynamicMethods.performOperation('set', 100);
const getValue2 = dynamicMethods.performOperation('get');

// Generic dynamic method invocation
const directAdd = invokeMethod(mathService, 'add', 15, 25);
const directMultiply = invokeMethod(mathService, 'multiply', 3, 9);

// Dynamic access with string manipulation
const methodNames = ['add', 'multiply'];
const dynamicResults = methodNames.map(name => {
  function callNamedMethod() {
    return mathService[name](2, 3);
  }
  return callNamedMethod();
});

export {
  ServiceManager,
  mathService,
  dynamicMethods,
  invokeMethod,
  manager,
  addResult,
  multiplyResult,
  calcResult1,
  calcResult2,
  getValue1,
  setValue1,
  getValue2,
  directAdd,
  directMultiply,
  dynamicResults,
};