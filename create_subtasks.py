#!/usr/bin/env python3
"""
Script to create sub-sub-tasks for Tree-sitter refactoring tasks.
Creates 11.100.X.1 (test overhaul) and 11.100.X.2 (tsc compliance) for each main task.
"""

import os
import re
from pathlib import Path

# Base directory for tasks
TASKS_DIR = Path("/Users/chuck/workspace/ariadne/backlog/tasks/epics/epic-11-codebase-restructuring")

# Task numbers to process (all refactoring tasks)
TASK_NUMBERS = list(range(1, 20))  # 11.100.1 through 11.100.19

def extract_section(content: str, section_title: str) -> str:
    """Extract a section from markdown content."""
    # Find the section header
    pattern = rf"^## {re.escape(section_title)}.*?(?=^## |\Z)"
    match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
    
    if match:
        return match.group(0).strip()
    return ""

def get_module_info(content: str) -> dict:
    """Extract module information from the task content."""
    info = {}
    
    # Extract module name from title
    title_match = re.search(r"# Task 11\.100\.\d+: Transform (\w+)", content)
    if title_match:
        info['module_name'] = title_match.group(1)
    
    # Extract module location
    location_match = re.search(r"\*\*Location\*\*: `([^`]+)`", content)
    if location_match:
        info['location'] = location_match.group(1)
    
    # Extract files count/info
    files_match = re.search(r"\*\*Files\*\*: ([^\n]+)", content)
    if files_match:
        info['files'] = files_match.group(1)
        
    return info

def create_test_subtask(task_num: int, module_info: dict, test_content: str) -> str:
    """Create the test overhaul subtask content."""
    module_name = module_info.get('module_name', 'unknown')
    location = module_info.get('location', 'unknown')
    
    return f"""# Task 11.100.{task_num}.1: Test Overhaul for {module_name}

## Parent Task

11.100.{task_num} - Transform {module_name} to Tree-sitter Queries

## Overview

Comprehensive test overhaul for the {module_name} module transformation to ensure 100% test coverage and zero test failures before and after the Tree-sitter query implementation.

**Module Location**: `{location}`

## Prerequisites

- [ ] **Task 11.100.0** - Documentation Architecture must be complete
- [ ] **Task 11.100.0.5** - Type system review must be complete
- [ ] Main transformation task 11.100.{task_num} must NOT be started until this is complete

{test_content}

## Dependencies

- Must be completed BEFORE task 11.100.{task_num} implementation begins
- Works in parallel with task 11.100.{task_num}.2 (TypeScript compliance)
- Validates the transformation will not break existing functionality

## Notes

- This task ensures transformation safety through comprehensive testing
- 100% test coverage is non-negotiable
- All tests must pass before transformation begins
- Test suite will validate query-based implementation matches manual implementation
"""

def create_tsc_subtask(task_num: int, module_info: dict, tsc_content: str) -> str:
    """Create the TypeScript compliance subtask content."""
    module_name = module_info.get('module_name', 'unknown')
    location = module_info.get('location', 'unknown')
    
    return f"""# Task 11.100.{task_num}.2: TypeScript Compliance for {module_name}

## Parent Task

11.100.{task_num} - Transform {module_name} to Tree-sitter Queries

## Overview

Ensure zero TypeScript compilation errors and warnings for the {module_name} module before and after Tree-sitter query transformation.

**Module Location**: `{location}`

## Prerequisites

- [ ] **Task 11.100.0** - Documentation Architecture must be complete
- [ ] **Task 11.100.0.5** - Type system review must be complete
- [ ] Main transformation task 11.100.{task_num} must NOT be started until this is complete

{tsc_content}

## Dependencies

- Must be completed BEFORE task 11.100.{task_num} implementation begins
- Works in parallel with task 11.100.{task_num}.1 (test overhaul)
- Ensures type safety throughout the transformation process

## Notes

- Zero tolerance for TypeScript compilation errors
- Must maintain strict type safety during query-based refactoring
- Type definitions must support both current and future query-based implementation
- IntelliSense support must be maintained throughout transformation
"""

def process_task_file(task_num: int) -> bool:
    """Process a single task file and create subtasks."""
    task_file = TASKS_DIR / f"task-epic-11.100.{task_num}-transform-*.md"
    
    # Find the actual file (glob pattern)
    import glob
    matching_files = glob.glob(str(task_file))
    
    if not matching_files:
        print(f"❌ No file found for task 11.100.{task_num}")
        return False
        
    task_file_path = Path(matching_files[0])
    print(f"📖 Processing {task_file_path.name}")
    
    try:
        with open(task_file_path, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error reading {task_file_path}: {e}")
        return False
    
    # Extract module information
    module_info = get_module_info(content)
    
    # Extract test and TypeScript sections
    test_section = extract_section(content, "Test Overhaul Requirements")
    tsc_section = extract_section(content, "TypeScript Compliance Requirements")
    
    if not test_section or not tsc_section:
        print(f"❌ Could not find required sections in task 11.100.{task_num}")
        print(f"   Test section found: {bool(test_section)}")
        print(f"   TSC section found: {bool(tsc_section)}")
        return False
    
    # Create subtask files
    test_subtask_file = TASKS_DIR / f"task-epic-11.100.{task_num}.1-test-overhaul.md"
    tsc_subtask_file = TASKS_DIR / f"task-epic-11.100.{task_num}.2-typescript-compliance.md"
    
    # Generate subtask content
    test_content = create_test_subtask(task_num, module_info, test_section)
    tsc_content = create_tsc_subtask(task_num, module_info, tsc_section)
    
    # Write subtask files
    try:
        with open(test_subtask_file, 'w') as f:
            f.write(test_content)
        print(f"✅ Created {test_subtask_file.name}")
        
        with open(tsc_subtask_file, 'w') as f:
            f.write(tsc_content)
        print(f"✅ Created {tsc_subtask_file.name}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating subtask files for 11.100.{task_num}: {e}")
        return False

def main():
    """Main execution function."""
    print("🚀 Creating sub-sub-tasks for Tree-sitter refactoring...")
    print(f"📁 Working in: {TASKS_DIR}")
    print(f"🎯 Processing tasks: 11.100.{TASK_NUMBERS[0]} through 11.100.{TASK_NUMBERS[-1]}")
    print()
    
    successful = 0
    failed = 0
    
    for task_num in TASK_NUMBERS:
        if process_task_file(task_num):
            successful += 1
        else:
            failed += 1
        print()  # Empty line between tasks
    
    print("📊 Summary:")
    print(f"✅ Successfully processed: {successful} tasks")
    print(f"❌ Failed to process: {failed} tasks")
    print(f"📝 Created {successful * 2} subtask files")
    
    if failed == 0:
        print("🎉 All tasks processed successfully!")
    else:
        print(f"⚠️  {failed} tasks had issues - check the output above")

if __name__ == "__main__":
    main()