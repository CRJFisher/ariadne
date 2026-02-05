"""
Uses simple module import with alias.
Tests: `import generate as predict_generate` pattern
"""

import generate as predict_generate

# Calls through aliased module import
result = predict_generate.generate_batched_predictions()
data = predict_generate.prepare_data()
