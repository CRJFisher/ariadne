// JSDoc-typed bindings shape - jsdoc_types.js

class Cache {
  get() {}
}

function createCache() {
  return new Cache();
}

class Resolver {
  constructor() {
    /** @type {Cache} */
    this.cache = createCache();
  }

  resolve() {
    this.cache.get();
  }
}

function lookup() {
  /** @type {Cache} */
  const cache = createCache();
  cache.get();
}

module.exports = { Resolver, lookup };
