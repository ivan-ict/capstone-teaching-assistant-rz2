import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

// Stack of open modals so Escape only closes the top-most one.
const openModals: symbol[] = [];

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

export const Modal: React.FC<ModalProps> = ({
  title,
  icon,
  onClose,
  children,
  size = 'md',
  footer
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Register once per mount so re-renders don't reorder the modal stack.
  useEffect(() => {
    const id = Symbol('modal');
    openModals.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === id)
        onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      openModals.splice(openModals.indexOf(id), 1);
    };
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
