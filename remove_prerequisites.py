#!/usr/bin/env python3
"""
Script to remove redundant Prerequisites sections from all subtasks.
"""

import os
import re
from pathlib import Path
import glob

# Base directory for tasks
TASKS_DIR = Path("/Users/chuck/workspace/ariadne/backlog/tasks/epics/epic-11-codebase-restructuring")

def remove_prerequisites_section(content: str) -> str:
    """Remove the Prerequisites section from markdown content."""
    # Pattern to match the Prerequisites section
    pattern = r"## Prerequisites\s*\n\n.*?(?=\n## |\Z)"
    
    # Remove the section
    result = re.sub(pattern, "", content, flags=re.MULTILINE | re.DOTALL)
    
    # Clean up any double newlines that might result
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result.strip() + '\n'

def process_file(file_path: Path) -> bool:
    """Process a single file and remove prerequisites section."""
    print(f"🧹 Processing {file_path.name}")
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
        return False
    
    # Remove prerequisites section
    cleaned_content = remove_prerequisites_section(content)
    
    # Only write if content changed
    if cleaned_content != content:
        try:
            with open(file_path, 'w') as f:
                f.write(cleaned_content)
            print(f"✅ Cleaned {file_path.name}")
            return True
        except Exception as e:
            print(f"❌ Error writing {file_path}: {e}")
            return False
    else:
        print(f"⚪ No changes needed for {file_path.name}")
        return True

def main():
    """Main execution function."""
    print("🧹 Removing redundant Prerequisites sections from subtasks...")
    print(f"📁 Working in: {TASKS_DIR}")
    print()
    
    # Find all subtask files (11.100.X.1 and 11.100.X.2 pattern)
    pattern = str(TASKS_DIR / "task-epic-11.100.*.*.md")
    subtask_files = glob.glob(pattern)
    
    # Also include main tasks 11.100.1-19 (not 11.100.0 or 11.100.0.5)
    main_task_pattern = str(TASKS_DIR / "task-epic-11.100.[1-9]*-transform-*.md")
    main_task_files = glob.glob(main_task_pattern)
    
    # Filter out 11.100.0* files from main tasks (we want to keep those)
    main_task_files = [f for f in main_task_files if not re.search(r'11\.100\.0\d*-', f)]
    
    all_files = subtask_files + main_task_files
    all_files = [Path(f) for f in sorted(all_files)]
    
    print(f"🎯 Found {len(all_files)} files to process")
    print()
    
    successful = 0
    failed = 0
    
    for file_path in all_files:
        if process_file(file_path):
            successful += 1
        else:
            failed += 1
        print()  # Empty line between files
    
    print("📊 Summary:")
    print(f"✅ Successfully processed: {successful} files")
    print(f"❌ Failed to process: {failed} files")
    
    if failed == 0:
        print("🎉 All files processed successfully!")
        print("🗑️  Redundant Prerequisites sections removed")
        print("📝 Task ordering now implies dependencies")
    else:
        print(f"⚠️  {failed} files had issues - check the output above")

if __name__ == "__main__":
    main()