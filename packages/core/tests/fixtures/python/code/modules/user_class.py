"""
User class module - user_class.py
Tests: Python class definitions and methods for cross-module class resolution
"""

from datetime import datetime
from typing import Optional, Dict, Any


class User:
    """User class with methods for testing cross-module resolution."""

    def __init__(self, name: str, email: str) -> None:
        """Initialize user with name and email."""
        self.name = name
        self.email = email
        self.created_at = datetime.now()
        self.active = True

    def get_name(self) -> str:
        """Get user's name."""
        return self.name

    def get_email(self) -> str:
        """Get user's email."""
        return self.email

    def update_profile(self, name: Optional[str] = None, email: Optional[str] = None) -> 'User':
        """Update user profile and return self for chaining."""
        if name is not None:
            self.name = name
        if email is not None:
            self.email = email
        return self

    def deactivate(self) -> None:
        """Deactivate the user account."""
        self.active = False

    def get_info(self) -> Dict[str, Any]:
        """Get user information as dictionary."""
        return {
            "name": self.name,
            "email": self.email,
            "created_at": self.created_at,
            "active": self.active,
        }