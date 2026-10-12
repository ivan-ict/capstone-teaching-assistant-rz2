import React from 'react';

type Tone = 'green' | 'slate' | 'amber' | 'rose' | 'blue';

const tones: Record<Tone, string> = {
  green:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  slate:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  amber:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({
  tone = 'slate',
  children
}) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tones[tone]}`}
  >
    {children}
  </span>
);
