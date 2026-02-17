---
id: task-185
title: 'Fix Category C false positives: Type[X] generic instantiation'
status: To Do
assignee: []
created_date: '2026-02-12 16:44'
labels: []
dependencies: []
---

## Description

False positives where a `Type[X]` constructor parameter is instantiated and methods are called on the result. Requires generic type parameter support to resolve the receiver type.

### Confirmed Code Patterns from AmazonAdv/projections

```python
# performance_data.py — upload_to_qb at line 122
class PerformanceDataUploader:
    def upload_to_qb(self) -> None:  # ← Detected as entry point
        final_data = self.get_data()
        write.rows_to_qb(self.table, list(final_data.values()))

# Caller at performance_data.py
def _upload_to_quickbase(
    profile: AmazonAdsProfile, uploader_class: Type[PerformanceDataUploader]
) -> None:
    uploader = uploader_class(profile)  # Type[X] instantiation
    uploader.upload_to_qb()             # Method call on generic instance
```

**Expected**: `upload_to_qb` is NOT an entry point (called via `uploader.upload_to_qb()`)
**Actual**: `upload_to_qb` detected as entry point because `Type[PerformanceDataUploader]` instantiation isn't resolved

Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-12T18-12-14.458Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Type[X] generic parameters resolve to the correct class type
- [ ] #2 uploader_class(profile).upload_to_qb() resolves correctly
<!-- AC:END -->
