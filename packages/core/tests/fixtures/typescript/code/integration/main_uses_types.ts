/**
 * Cross-module class methods - main_uses_types.ts
 * Tests: imports class, creates instance, calls methods
 */

import { User } from "./types";

// Constructor call and type binding
const user = new User("John Doe", "john@example.com");

// Method calls on imported class instance
const name = user.getName();
const email = user.getEmail();

// Method call with side effects
user.updateName("Jane Doe");
const updatedName = user.getName();

export { user, name, email, updatedName };