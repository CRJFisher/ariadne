import { describe, it, expect } from 'vitest';
import { create_incremental_updater } from '..';

describe('incremental_updates/updater', () => {
  it('updates whole file', () => {
    const u = create_incremental_updater();
    const r1 = u.update_file('a.ts', 'const a=1;');
    expect(r1.source_code).toBe('const a=1;');
  });

  it('applies range edits', () => {
    const u = create_incremental_updater();
    u.update_file('a.ts', 'hello world');
    const r = u.update_file_range('a.ts', { row: 0, column: 6 }, { row: 0, column: 11 }, 'Ariadne');
    expect(r.source_code).toBe('hello Ariadne');
  });
});


