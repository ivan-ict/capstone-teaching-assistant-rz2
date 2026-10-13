import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Sort } from '../../../api/client';

export const SortableHeader: React.FC<{
  label: string;
  field: string;
  sort: Sort | null;
  onSort: (field: string) => void;
  className?: string;
}> = ({ label, field, sort, onSort, className = '' }) => {
  const active = sort?.by === field;
  const Icon = !active ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? 'text-blue-600 dark:text-blue-400' : 'opacity-50'}`} />
      </button>
    </th>
  );
};
