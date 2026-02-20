"""
Cross-module class usage - uses_user.py
Tests: Python class imports, constructor calls, method calls across modules
"""

from .user_class import User

# Constructor call and type binding
user = User("Alice Smith", "alice@example.com")

# Method calls on imported class instance
user_name = user.get_name()
user_email = user.get_email()

# Method chaining
updated_user = user.update_profile(name="Alice Johnson", email="alice.johnson@example.com")

# Additional method calls after update
final_name = updated_user.get_name()
user_info = user.get_info()

# Method call with side effects
user.deactivate()
final_info = user.get_info()

# Store results
results = {
    "user": user,
    "user_name": user_name,
    "user_email": user_email,
    "final_name": final_name,
    "user_info": user_info,
    "final_info": final_info,
}