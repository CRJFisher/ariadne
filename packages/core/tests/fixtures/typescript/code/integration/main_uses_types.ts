/**
 * Cross-module class methods - main_uses_types.ts
 * Tests: imports class, creates instance, calls methods
 */

import { User } from "./types";

// Constructor call and type binding
const user = new User("John Doe", "john@example.com");

// Method calls on imported class instance
const name = user.get_name();
const email = user.get_email();

// Method call with side effects
user.update_name("Jane Doe");
const updated_name = user.get_name();

export { user, name, email, updated_name };