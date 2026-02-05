/**
 * ES6 class exports - user_class.js
 * Tests: ES6 class exports, method definitions for cross-module class resolution
 */

export class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
    this.createdAt = new Date();
  }

  getName() {
    return this.name;
  }

  getEmail() {
    return this.email;
  }

  updateProfile(newName, newEmail) {
    this.name = newName;
    this.email = newEmail;
    return this;
  }

  getInfo() {
    return {
      name: this.name,
      email: this.email,
      createdAt: this.createdAt,
    };
  }
}