/**
 * Object literal methods
 * Tests: Methods defined in object literals, method calls on object literals
 */

// Object literal with methods
const calculator = {
  value: 0,

  add(num) {
    this.value += num;
    return this;
  },

  multiply(num) {
    this.value *= num;
    return this;
  },

  getValue() {
    return this.value;
  },

  reset() {
    this.value = 0;
    return this;
  },

  // Method that calls other methods
  compute(operations) {
    function processOperation(op) {
      if (op.type === 'add') {
        return this.add(op.value);
      } else if (op.type === 'multiply') {
        return this.multiply(op.value);
      }
    }

    operations.forEach(processOperation.bind(this));
    return this.getValue();
  }
};

// Nested object literals
const apiClient = {
  baseUrl: 'https://api.example.com',

  users: {
    get(id) {
      function buildUrl() {
        return `${apiClient.baseUrl}/users/${id}`;
      }
      return buildUrl();
    },

    create(userData) {
      function validateData() {
        return userData && userData.name && userData.email;
      }

      if (validateData()) {
        return { success: true, data: userData };
      }
      return { success: false };
    }
  },

  posts: {
    list() {
      function getEndpoint() {
        return `${apiClient.baseUrl}/posts`;
      }
      return getEndpoint();
    },

    getByUser(userId) {
      const url = this.list();
      function addUserFilter() {
        return `${url}?user=${userId}`;
      }
      return addUserFilter();
    }
  }
};

// Object with computed property methods
const dynamicObject = {
  data: { count: 0 },

  ['get' + 'Count']() {
    function getCurrentCount() {
      return this.data.count;
    }
    return getCurrentCount.call(this);
  },

  ['set' + 'Count'](value) {
    function updateCount() {
      this.data.count = value;
    }
    updateCount.call(this);
    return this;
  }
};

// Using object literal methods
const calcResult1 = calculator.add(5).multiply(3).getValue();
const calcResult2 = calculator.reset().getValue();

const userUrl = apiClient.users.get(123);
const createResult = apiClient.users.create({ name: "John", email: "john@example.com" });

const postsUrl = apiClient.posts.list();
const userPostsUrl = apiClient.posts.getByUser(456);

const countResult1 = dynamicObject.getCount();
const countResult2 = dynamicObject.setCount(42).getCount();

module.exports = {
  calculator,
  apiClient,
  dynamicObject,
  calcResult1,
  calcResult2,
  userUrl,
  createResult,
  postsUrl,
  userPostsUrl,
  countResult1,
  countResult2,
};
