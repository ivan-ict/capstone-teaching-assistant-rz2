import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'warning';
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy,
  error,
  onConfirm,
  onCancel
}) => (
  <Modal
    title={title}
    size="sm"
    onClose={onCancel}
    footer={
      <>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone === 'danger' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'}`}
      >
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
        <div>{message}</div>
        {error && (
          <p role="alert" className="text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  </Modal>
);
