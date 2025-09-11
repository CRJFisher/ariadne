#!/usr/bin/env python3
"""
Script to clean up original task files by removing the Test Overhaul and TypeScript Compliance sections
that were moved to subtasks.
"""

import os
import re
from pathlib import Path

# Base directory for tasks
TASKS_DIR = Path("/Users/chuck/workspace/ariadne/backlog/tasks/epics/epic-11-codebase-restructuring")

# Task numbers to process (tasks that had sections moved)
TASK_NUMBERS = list(range(3, 20))  # 11.100.3 through 11.100.19 (1 and 2 handled manually)

def remove_sections(content: str, sections_to_remove: list) -> str:
    """Remove specified sections from markdown content."""
    lines = content.split('\n')
    result_lines = []
    skip_section = False
    current_section = None
    
    for line in lines:
        # Check if this line starts a section header
        if line.startswith('## '):
            section_name = line[3:].strip()
            current_section = section_name
            
            # Check if we should skip this section
            if any(remove_section in section_name for remove_section in sections_to_remove):
                skip_section = True
                continue
            else:
                skip_section = False
                result_lines.append(line)
        
        # If we're not skipping, add the line
        elif not skip_section:
            result_lines.append(line)
    
    return '\n'.join(result_lines)

def add_subtask_references(content: str, task_num: int) -> str:
    """Add references to the new subtasks in the main task."""
    
    # Find where to insert the subtask references (after Prerequisites section)
    lines = content.split('\n')
    result_lines = []
    inserted = False
    
    for i, line in enumerate(lines):
        result_lines.append(line)
        
        # Insert after Prerequisites section
        if line.strip() == "**DO NOT PROCEED** with implementation until prerequisites are verified complete." and not inserted:
            result_lines.append('')
            result_lines.append('## Required Subtasks')
            result_lines.append('')
            result_lines.append('**CRITICAL**: These subtasks must be completed before implementation begins:')
            result_lines.append('')
            result_lines.append(f'- [ ] **Task 11.100.{task_num}.1** - Test Overhaul for this module')
            result_lines.append('  - Achieve 100% test coverage')
            result_lines.append('  - Ensure all tests pass before transformation')
            result_lines.append('  - Validate query-based implementation matches manual implementation')
            result_lines.append('')
            result_lines.append(f'- [ ] **Task 11.100.{task_num}.2** - TypeScript Compliance for this module')
            result_lines.append('  - Achieve zero TypeScript compilation errors')
            result_lines.append('  - Ensure strict type safety throughout transformation')
            result_lines.append('  - Maintain IntelliSense support')
            result_lines.append('')
            inserted = True
    
    return '\n'.join(result_lines)

def update_success_criteria(content: str) -> str:
    """Update success criteria to reference the subtasks."""
    
    # Replace the Quality Gates section with a reference
    pattern = r"### Quality Gates \(MANDATORY\)\n.*?(?=\n### |\n## |\Z)"
    replacement = """### Quality Gates (MANDATORY)

**All quality gates are defined in the required subtasks:**

- [ ] **100% test coverage achieved** (Task 11.100.X.1)
- [ ] **All tests passing** (Task 11.100.X.1)  
- [ ] **Zero TypeScript compilation errors** (Task 11.100.X.2)
- [ ] **Zero TypeScript warnings** (Task 11.100.X.2)
- [ ] **Performance improvement validated** (queries faster than manual)
- [ ] **Real-world accuracy confirmed** (corpus/ validation passes)
- [ ] **All language-specific .scm files created and tested**"""
    
    result = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    return result

def process_task_file(task_num: int) -> bool:
    """Process a single task file and clean it up."""
    import glob
    
    task_file = TASKS_DIR / f"task-epic-11.100.{task_num}-transform-*.md"
    matching_files = glob.glob(str(task_file))
    
    if not matching_files:
        print(f"❌ No file found for task 11.100.{task_num}")
        return False
        
    task_file_path = Path(matching_files[0])
    print(f"🧹 Cleaning {task_file_path.name}")
    
    try:
        with open(task_file_path, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error reading {task_file_path}: {e}")
        return False
    
    # Remove the sections that were moved to subtasks
    sections_to_remove = ["Test Overhaul Requirements", "TypeScript Compliance Requirements"]
    cleaned_content = remove_sections(content, sections_to_remove)
    
    # Add subtask references
    cleaned_content = add_subtask_references(cleaned_content, task_num)
    
    # Update success criteria
    cleaned_content = update_success_criteria(cleaned_content)
    
    # Write back the cleaned content
    try:
        with open(task_file_path, 'w') as f:
            f.write(cleaned_content)
        print(f"✅ Cleaned {task_file_path.name}")
        return True
        
    except Exception as e:
        print(f"❌ Error writing {task_file_path}: {e}")
        return False

def main():
    """Main execution function."""
    print("🧹 Cleaning up original task files...")
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
    print(f"✅ Successfully cleaned: {successful} tasks")
    print(f"❌ Failed to clean: {failed} tasks")
    
    if failed == 0:
        print("🎉 All tasks cleaned successfully!")
        print("📝 Original tasks now reference their subtasks")
        print("🔗 Test and TypeScript requirements moved to dedicated subtasks")
    else:
        print(f"⚠️  {failed} tasks had issues - check the output above")

if __name__ == "__main__":
    main()