"""
Uses dotted module imports with aliases.
Tests: `import pkg.mod as alias` pattern for subpackages
"""

import subpkg.processor as proc
import subpkg.nested.deep as deep_mod

# Calls through dotted aliased imports
batch = proc.process_batch()
valid = proc.validate_input()
analysis = deep_mod.deep_analysis()
