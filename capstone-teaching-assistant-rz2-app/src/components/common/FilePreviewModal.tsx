import React, { useEffect, useMemo } from 'react';
import { AlertCircle, Download, FileText, HardDrive, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AttachedFile } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

interface FilePreviewModalProps {
  file: AttachedFile | null;
  onClose: () => void;
}

function decodeDataUrl(dataUrl?: string): string | null {
  if (!dataUrl) return null;
  try {
    const encoded = dataUrl.split(',', 2)[1];
    const binary = atob(encoded);
    return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const { downloadFile } = useApp();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const extension = file?.name.split('.').pop()?.toLowerCase() || '';
  const isImage = Boolean(file?.isImage || file?.type.startsWith('image/'));
  const isPdf = Boolean(file?.type.includes('pdf') || extension === 'pdf');
  const isMarkdown = extension === 'md' || file?.type === 'text/markdown';
  const isText = Boolean(file?.type.startsWith('text/') || isMarkdown);
  const textContent = useMemo(
    () => isText ? decodeDataUrl(file?.dataUrl) : null,
    [file?.dataUrl, isText],
  );

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">{file.name}</h2>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{formatBytes(file.size)}</span>
              <span>{formatDate(file.uploadedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => downloadFile(file)} className="rounded-xl bg-blue-600 p-2 text-white hover:bg-blue-700" title="Download file"><Download className="h-4 w-4" /></button>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="min-h-72 flex-1 overflow-auto bg-slate-50 p-5 dark:bg-slate-950">
          {file.isPreviewLoading ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-500">Loading preview…</div>
          ) : file.previewError ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <p className="max-w-md text-sm font-semibold text-slate-700 dark:text-slate-200">Preview unavailable</p>
              <p className="max-w-md text-xs text-slate-500">{file.previewError}</p>
            </div>
          ) : isImage && file.dataUrl ? (
            <img src={file.dataUrl} alt={file.name} className="mx-auto max-h-[70vh] max-w-full rounded-xl object-contain" />
          ) : isPdf && file.dataUrl ? (
            <iframe src={file.dataUrl} title={file.name} className="h-[70vh] w-full rounded-xl bg-white" />
          ) : isMarkdown && textContent !== null ? (
            <article className="prose mx-auto max-w-3xl dark:prose-invert"><ReactMarkdown>{textContent}</ReactMarkdown></article>
          ) : isText && textContent !== null ? (
            <pre className="mx-auto max-w-3xl whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{textContent}</pre>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
              <FileText className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Preview unavailable for this file format</p>
              <p className="text-xs text-slate-500">Download the original file to view it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
