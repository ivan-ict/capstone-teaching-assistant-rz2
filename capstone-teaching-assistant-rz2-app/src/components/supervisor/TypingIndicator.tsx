import React from 'react';

export const TypingIndicator: React.FC = () => (
  <div
    role="status"
    aria-label="Assistant is responding"
    className="flex items-center gap-1.5 py-1"
  >
    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
    <span className="ml-2 text-xs text-slate-400">Thinking…</span>
  </div>
);
