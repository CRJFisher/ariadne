"""
Import patterns
Tests: import statements, from imports
"""

import os
import sys
from typing import List, Dict, Optional


def get_environment_variables() -> Dict[str, str]:
    return dict(os.environ)


def get_python_version() -> str:
    return sys.version


def process_list(items: List[str]) -> Optional[str]:
    if not items:
        return None
    return items[0]
