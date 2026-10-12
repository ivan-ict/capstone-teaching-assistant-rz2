import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ForgotPasswordModalProps {
  initialIdentifier?: string;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ initialIdentifier = '', onClose }) => {
  const { requestPasswordReset } = useApp();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) {
      setError('Please enter your username or email.');
      return;
    }
    setIsSubmitting(true);
    const result = await requestPasswordReset(identifier);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setSuccessMessage(result.message);
  };

  return (
    <div
      id="forgot-password-modal-backdrop"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
    >
      <div
        id="forgot-password-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Reset your password</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage ? (
            <div
              id="forgot-password-success"
              className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Enter your username or email. A new password will be sent to the email on your account, and your
                current password will stop working.
              </p>
              <div>
                <label
                  htmlFor="forgot-password-identifier"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Username or email
                </label>
                <input
                  id="forgot-password-identifier"
                  type="text"
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Administrator accounts cannot be reset here. Please contact your system administrator.
              </p>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {successMessage ? 'Back to sign in' : 'Cancel'}
            </button>
            {!successMessage && (
              <button
                id="submit-forgot-password-btn"
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Sending...' : 'Send new password'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
