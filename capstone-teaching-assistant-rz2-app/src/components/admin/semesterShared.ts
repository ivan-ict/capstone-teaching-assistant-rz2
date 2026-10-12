export const inputClass =
  'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export const labelClass =
  'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

export const thClass =
  'px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The operation failed.';
