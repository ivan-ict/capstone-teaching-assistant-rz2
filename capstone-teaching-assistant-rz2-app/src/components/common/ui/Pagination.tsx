import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination: React.FC<{
  page: number;
  total: number;
  pageSize?: number;
  change: (page: number) => void;
}> = ({ page, total, pageSize = 20, change }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
      <span>
        {total} total · Page {page} of {pages}
      </span>
      <div className="flex gap-1">
        <button
          aria-label="Previous"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={page <= 1}
          onClick={() => change(page - 1)}
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <button
          aria-label="Next"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={page * pageSize >= total}
          onClick={() => change(page + 1)}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
