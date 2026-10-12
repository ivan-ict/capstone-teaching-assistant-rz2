import { describe, expect, it } from 'vitest';
import { groupReferences } from './ChatArea';

describe('groupReferences', () => {
  it('merges chunks from the same file and drops duplicate excerpts', () => {
    const groups = groupReferences([
      { fileId: 'a', filename: 'a.pdf', content: 'one' },
      { fileId: 'b', filename: 'b.md', content: 'two' },
      { fileId: 'a', filename: 'a.pdf', content: 'three' },
      { fileId: 'a', filename: 'a.pdf', content: 'one' }
    ]);
    expect(groups).toEqual([
      { fileId: 'a', filename: 'a.pdf', mimeType: undefined, chunks: ['one', 'three'] },
      { fileId: 'b', filename: 'b.md', mimeType: undefined, chunks: ['two'] }
    ]);
  });
});
