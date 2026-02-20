/**
 * Cross-module class usage - uses_user.js
 * Tests: ES6 class imports, constructor calls, method calls across modules
 */

import { User } from './user_class.js';

// Constructor call and type binding
const user = new User("Alice Smith", "alice@example.com");

// Method calls on imported class instance
const userName = user.getName();
const userEmail = user.getEmail();

// Method chaining
const updatedUser = user.updateProfile("Alice Johnson", "alice.johnson@example.com");

// Additional method call after update
const finalName = updatedUser.getName();
const userInfo = user.getInfo();

// Export results
export {
  user,
  userName,
  userEmail,
  finalName,
  userInfo,
};