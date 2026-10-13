import { useState } from 'react';
import type { Sort } from '../api/client';

/**
 * Column sort state shared by admin tables. Clicking the active column flips the
 * order; clicking a new column starts with `firstOrder` (asc by default).
 */
export function useTableSort(initial: Sort | null = null, onChange?: () => void) {
  const [sort, setSort] = useState<Sort | null>(initial);
  const toggleSort = (by: string, firstOrder: Sort['order'] = 'asc') => {
    setSort((current) =>
      current?.by === by
        ? { by, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { by, order: firstOrder },
    );
    onChange?.();
  };
  return { sort, toggleSort };
}
