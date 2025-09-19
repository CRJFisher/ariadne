# Test fixture: Python import statements and module organization

# Standard library imports
import os
import sys
import json
import pathlib
from collections import defaultdict, Counter
from typing import Any, Optional, Union

# Aliased imports
import numpy as np
import pandas as pd
from datetime import datetime as dt
from pathlib import Path as PathType

# Wildcard imports (generally discouraged but valid)
from math import *

# Relative imports (would work in a package context)
# from . import sibling_module
# from .. import parent_module
# from ...package import deep_module
# from .utils import helper_function
# from ..shared.config import Configuration

# Multi-line imports
from typing import (
    List,
    Dict,
    Tuple,
    Set,
    Callable,
    TypeVar,
    Generic
)

# Conditional imports
if sys.version_info >= (3, 10):
    from typing import TypeAlias
else:
    TypeAlias = type

# Try-except imports (fallback imports)
try:
    import tomllib
except ImportError:
    import tomli as tomllib

# Import within function (lazy import)
def use_special_library():
    """Function with local import."""
    import specialized_module
    return specialized_module.special_function()

# Import within class
class DataProcessor:
    """Class with method-level imports."""

    def process_json(self, data):
        """Process JSON data."""
        import json
        return json.loads(data)

    def process_yaml(self, data):
        """Process YAML data."""
        import yaml
        return yaml.safe_load(data)

# Nested package imports
from urllib.parse import urlparse, urljoin
from email.mime.text import MIMEText
from xml.etree.ElementTree import Element, SubElement

# Module-level __all__ definition
__all__ = [
    'public_function',
    'PublicClass',
    'CONSTANT',
    'imported_function'
]

# Using imported items
def public_function():
    """Function using imported modules."""
    current_path = pathlib.Path.cwd()
    timestamp = dt.now()
    data = defaultdict(list)
    counter = Counter([1, 2, 2, 3, 3, 3])
    return {
        'path': str(current_path),
        'time': timestamp.isoformat(),
        'counts': dict(counter)
    }

class PublicClass:
    """Class using imported types."""

    def __init__(self, data: Optional[Dict[str, Any]] = None):
        self.data = data or {}

    def to_json(self) -> str:
        """Convert to JSON using imported module."""
        return json.dumps(self.data)

    def from_json(self, json_str: str) -> None:
        """Load from JSON using imported module."""
        self.data = json.loads(json_str)

CONSTANT = os.environ.get('MY_CONSTANT', 'default')

# Re-exports (importing and exposing in __all__)
from os.path import join as path_join
imported_function = path_join

# Submodule imports (if this were a package)
# from .submodule import SubClass
# from .utils.helpers import utility_function
# from .core import CoreClass, core_function

# Dynamic imports
def dynamic_import(module_name: str):
    """Dynamically import a module."""
    import importlib
    return importlib.import_module(module_name)

# Import annotations
from __future__ import annotations  # Enable postponed annotation evaluation

# Type checking imports (only during type checking)
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from some_heavy_module import HeavyClass

def process_heavy(obj: 'HeavyClass') -> None:
    """Function using type-check-only import."""
    pass

# Namespace package imports (PEP 420)
# import namespace_package.subpackage

# Import hooks and meta imports
import sys
import importlib.util

def custom_import(name, path):
    """Custom import function."""
    spec = importlib.util.spec_from_file_location(name, path)
    if spec and spec.loader:
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        return module
    return None

# Usage of various imported items
def demo_imports():
    """Demonstrate usage of imported items."""
    # Using standard library
    home_dir = os.path.expanduser("~")
    json_data = json.dumps({"key": "value"})

    # Using aliased imports
    arr = np.array([1, 2, 3])  # Would work with numpy installed
    df = pd.DataFrame()  # Would work with pandas installed
    now = dt.now()
    p = PathType("/tmp/file.txt")

    # Using wildcard imports
    result = sin(pi / 2)  # From math import *

    # Using multi-line imports
    my_list: List[int] = [1, 2, 3]
    my_dict: Dict[str, Any] = {"key": "value"}

    return {
        'home': home_dir,
        'json': json_data,
        'time': now,
        'math_result': result
    }