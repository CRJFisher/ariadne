# Task: Update Python for Direct Definition Builders

## Status: Created

## Parent Task

task-epic-11.102.5 - Update Language Configs

## Objective

Update Python language support to use the new direct definition builder system, removing all NormalizedCapture dependencies.

## Sub-tasks

1. **Update Language Config** (102.5.3.1)
   - Convert to builder pattern
   - Handle Python-specific features (decorators, type hints, docstrings)
   - Direct Definition creation

2. **Update Query File** (102.5.3.2)
   - Clean up python.scm
   - Add decorator captures
   - Handle class inheritance (multiple inheritance)

3. **Update Tests** (102.5.3.3)
   - Fix language config tests
   - Test Python-specific features
   - Ensure comprehensive field coverage

## Python-Specific Requirements

- **Decorators** - Function, method, class decorators
- **Type hints** - Function signatures, variable annotations
- **Docstrings** - Class, function, method documentation
- **Multiple inheritance** - Classes with multiple base classes
- **Class methods** - @classmethod decorated methods
- **Static methods** - @staticmethod decorated methods
- **Properties** - @property decorated methods
- **Async functions** - async def functions
- **Global/nonlocal** - Variable scope modifiers
- **Import variations** - from X import Y, import X as Y

## Success Criteria

- [ ] Python config uses builder pattern
- [ ] All Python-specific features captured
- [ ] Query file contains only necessary captures
- [ ] All Python tests pass
- [ ] 100% coverage of processed fields

## Dependencies

- task-epic-11.102.1, 102.2, 102.3 (Builder systems exist)
- task-epic-11.102.4 (Old types removed)

## Estimated Effort

~3 hours total