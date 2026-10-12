import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';

const variants: Record<Variant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20',
  secondary:
    'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm',
  warning:
    'border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950',
  ghost:
    'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${variants[variant]} ${className}`}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'danger';
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  tone = 'default',
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={`p-1.5 rounded-lg text-slate-400 transition cursor-pointer disabled:opacity-40 ${tone === 'danger' ? 'hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40' : 'hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/40'} ${className}`}
    {...rest}
  >
    {children}
  </button>
);
