import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  RotateCcw,
  XCircle,
  FileText,
  Image as ImageIcon,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttachedFile, Page, Semester } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { SUPPORTED_UPLOAD_ACCEPT } from '../../constants/files';
import { Modal } from '../common/ui/Modal';
import { Button, IconButton } from '../common/ui/Button';
import { Badge } from '../common/ui/Badge';
import { SearchInput } from '../common/ui/Card';
import { ConfirmDialog } from '../common/ui/ConfirmDialog';
import { Pagination } from '../common/ui/Pagination';
import { SortableHeader } from '../common/ui/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import { errorMessage, thClass } from './semesterShared';

const statusBadge = (status?: AttachedFile['processingStatus']) => {
  if (status === 'PROCESSING') return <Badge tone="amber">Processing</Badge>;
  if (status === 'FAILED') return <Badge tone="rose">Failed</Badge>;
  return <Badge tone="green">Ready</Badge>;
};

type UploadStatus = 'queued' | 'uploading' | 'ready' | 'failed';

interface UploadItem {
  key: string;
  file: File;
  status: UploadStatus;
  error?: string;
}

const POLL_INTERVAL_MS = 4000;

const isImage = (file: AttachedFile) =>
  file.isImage || file.type.startsWith('image/');

export function SemesterFiles({
  semester,
  close,
  changed
}: {
  semester: Semester;
  close: () => void;
  changed: (full?: boolean) => Promise<void>;
}) {
  const { api, downloadFile, previewFile } = useApp();
  const readOnly = Boolean(semester.deleted_at);
  const [data, setData] = useState<Page<AttachedFile>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { sort, toggleSort } = useTableSort({ by: 'created_at', order: 'desc' }, () => setPage(1));
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [removing, setRemoving] = useState<AttachedFile[] | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Debounce the server-side search so each keystroke does not refetch.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .semesterFiles(semester.id, page, { search: query, sort })
      .then((data) => {
        if (!cancelled) setData(data);
      })
      .catch((error) => {
        if (!cancelled) setError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, semester.id, page, query, sort, revision]);

  const uploading = uploads.some(
    (item) => item.status === 'queued' || item.status === 'uploading'
  );
  const hasProcessing = data.items.some(
    (file) => file.processingStatus === 'PROCESSING'
  );
  // Rows can be left in PROCESSING (e.g. a dropped request); keep checking
  // until the server reports a final status.
  useEffect(() => {
    if (!hasProcessing || uploading) return;
    const timer = window.setInterval(
      () => setRevision((v) => v + 1),
      POLL_INTERVAL_MS
    );
    return () => window.clearInterval(timer);
  }, [hasProcessing, uploading]);

  const visible = data.items;
  const selectedFiles = data.items.filter((file) => selected.includes(file.id));
  const allVisibleSelected =
    visible.length > 0 && visible.every((file) => selected.includes(file.id));

  const refresh = async () => {
    setSelected([]);
    setRevision((v) => v + 1);
    await changed();
  };

  const setUploadStatus = (
    key: string,
    status: UploadStatus,
    error?: string
  ) =>
    setUploads((prev) =>
      prev.map((item) => (item.key === key ? { ...item, status, error } : item))
    );

  const runUploads = async (items: UploadItem[]) => {
    setBusy(true);
    setError('');
    const failures: string[] = [];
    try {
      for (const item of items) {
        setUploadStatus(item.key, 'uploading');
        try {
          await api.uploadSemesterFile(semester.id, item.file);
          setUploadStatus(item.key, 'ready');
        } catch (error) {
          const message = errorMessage(error);
          failures.push(`${item.file.name}: ${message}`);
          setUploadStatus(item.key, 'failed', message);
        }
        // Refresh the current page in place and update the semester's file count.
        setRevision((v) => v + 1);
        void changed(false);
      }
      await changed();
    } catch (error) {
      failures.push(errorMessage(error));
    } finally {
      setError(failures.join('\n'));
      setBusy(false);
    }
  };

  const upload = (files: File[]) => {
    // Images are the slowest to process, so upload them after documents.
    const isImageFile = (file: File) =>
      file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);
    const ordered = [
      ...files.filter((file) => !isImageFile(file)),
      ...files.filter(isImageFile)
    ];
    const items = ordered.map((file, index) => ({
      key: `${Date.now()}-${index}-${file.name}`,
      file,
      status: 'queued' as const
    }));
    setUploads((prev) => [
      ...prev.filter((item) => item.status !== 'ready'),
      ...items
    ]);
    void runUploads(items);
  };

  const retry = (item: UploadItem) => {
    setUploadStatus(item.key, 'queued');
    void runUploads([item]);
  };

  const finished = uploads.filter(
    (item) => item.status === 'ready' || item.status === 'failed'
  ).length;
  const failedCount = uploads.filter((item) => item.status === 'failed').length;

  const guardedClose = () => {
    if (uploading) setConfirmClose(true);
    else close();
  };

  const remove = async (files: AttachedFile[]) => {
    setBusy(true);
    setError('');
    try {
      for (const file of files)
        await api.deleteSemesterFile(semester.id, file.id);
      setRemoving(null);
      setPage(1);
      await refresh();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((value) => value !== id)
    );

  return (
    <Modal
      title={`Files · ${semester.name}`}
      icon={<FileText className="w-4 h-4" />}
      size="xl"
      onClose={guardedClose}
    >
      <div
        className="space-y-4"
        onDragOver={(event) => {
          if (readOnly) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (readOnly) return;
          event.preventDefault();
          setDragging(false);
          const files = Array.from(event.dataTransfer.files);
          if (files.length) upload(files);
        }}
      >
        {readOnly ? (
          <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm text-amber-700 dark:text-amber-300">
            Archived semester. Files are read-only.
          </p>
        ) : (
          <div
            className={`flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border-2 border-dashed transition ${dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-300 dark:border-slate-700'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Drag &amp; drop files here
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Supports TXT, MD, PDF, DOCX, JPG, PNG, WebP
              </p>
            </div>
            <Button
              variant="primary"
              className="min-w-[9.5rem] justify-center"
              icon={<Upload size={16} />}
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {busy ? 'Uploading…' : 'Upload files'}
            </Button>
            <input
              ref={fileInput}
              aria-label="Upload semester files"
              type="file"
              multiple
              hidden
              accept={SUPPORTED_UPLOAD_ACCEPT}
              disabled={busy}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = '';
                if (files.length) upload(files);
              }}
            />
          </div>
        )}

        {uploads.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60">
              <p
                role="status"
                className="flex-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {uploading
                  ? `Uploading ${Math.min(finished + 1, uploads.length)} of ${uploads.length}…`
                  : `Done: ${uploads.length - failedCount} uploaded${failedCount ? `, ${failedCount} failed` : ''}`}
              </p>
              {!uploading && (
                <button
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  onClick={() => setUploads([])}
                >
                  Dismiss
                </button>
              )}
            </div>
            <div className="h-1 bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full transition-all ${failedCount ? 'bg-amber-500' : 'bg-blue-600'}`}
                style={{ width: `${(finished / uploads.length) * 100}%` }}
              />
            </div>
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {uploads.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-3 px-4 py-2 text-xs"
                >
                  <span className="shrink-0">
                    {item.status === 'uploading' && (
                      <Loader2 size={16} className="animate-spin text-blue-600" />
                    )}
                    {item.status === 'ready' && (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    )}
                    {item.status === 'failed' && (
                      <XCircle size={16} className="text-rose-600" />
                    )}
                    {item.status === 'queued' && (
                      <span className="block w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      title={item.file.name}
                      className="truncate font-medium text-slate-700 dark:text-slate-200"
                    >
                      {item.file.name}
                    </p>
                    {item.error && (
                      <p
                        title={item.error}
                        className="truncate text-rose-600 dark:text-rose-400"
                      >
                        {item.error}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-slate-400">
                    {item.status === 'queued'
                      ? 'Queued'
                      : item.status === 'uploading'
                        ? 'Processing…'
                        : formatBytes(item.file.size)}
                  </span>
                  {item.status === 'failed' && !uploading && (
                    <button
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-semibold"
                      onClick={() => retry(item)}
                    >
                      <RotateCcw size={12} />
                      Retry
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 whitespace-pre-wrap"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput
            icon={<Search size={16} />}
            aria-label="Search files"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Total: {data.total} files • Selected: {selected.length}
          </span>
        </div>

        {selected.length > 0 && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-blue-600 text-white shadow-lg">
            <span className="text-xs font-semibold px-2">
              {selected.length} selected
            </span>
            <button
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
              onClick={() =>
                selectedFiles.forEach((file) => void downloadFile(file))
              }
            >
              <Download size={14} /> Download
            </button>
            {!readOnly && (
              <button
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-rose-500 text-xs font-semibold"
                onClick={() => setRemoving(selectedFiles)}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button
              aria-label="Clear selection"
              className="ml-auto p-1.5 rounded-lg hover:bg-white/20"
              onClick={() => setSelected([])}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {/* Only the first load shows a placeholder; refreshes keep the table in place. */}
          {loading && !data.items.length && !query ? (
            <p className="p-6 text-sm text-slate-500">Loading files…</p>
          ) : (
            <table className="w-full min-w-[640px] table-fixed text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="pl-4 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all files"
                      checked={allVisibleSelected}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? visible.map((file) => file.id) : []
                        )
                      }
                      className="accent-blue-600"
                    />
                  </th>
                  <SortableHeader label="Name" field="name" sort={sort} onSort={toggleSort} className={thClass} />
                  <SortableHeader label="Size" field="size" sort={sort} onSort={toggleSort} className={`${thClass} w-24`} />
                  <SortableHeader label="Status" field="status" sort={sort} onSort={toggleSort} className={`${thClass} w-28`} />
                  <SortableHeader label="Uploaded" field="created_at" sort={sort} onSort={toggleSort} className={`${thClass} w-32`} />
                  <th className={`${thClass} w-32 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((file) => (
                  <tr
                    key={file.id}
                    className={`group transition ${selected.includes(file.id) ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                  >
                    <td className="pl-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${file.name}`}
                        checked={selected.includes(file.id)}
                        onChange={(e) => toggle(file.id, e.target.checked)}
                        className="accent-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3 min-w-0">
                      <button
                        title={file.name}
                        className="flex w-full items-center gap-3 text-left min-w-0"
                        onClick={() => previewFile(file)}
                      >
                        <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                          {isImage(file) ? (
                            <ImageIcon size={16} />
                          ) : (
                            <FileText size={16} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                            {file.name}
                          </span>
                          {file.processingError && (
                            <span
                              title={file.processingError}
                              className="block text-xs text-rose-600 dark:text-rose-400 line-clamp-2 break-words"
                            >
                              {file.processingError}
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatBytes(file.size)}
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(file.processingStatus)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(file.uploadedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          label={`Preview ${file.name}`}
                          onClick={() => previewFile(file)}
                        >
                          <Eye size={16} />
                        </IconButton>
                        <IconButton
                          label={`Download ${file.name}`}
                          onClick={() => void downloadFile(file)}
                        >
                          <Download size={16} />
                        </IconButton>
                        {!readOnly && (
                          <IconButton
                            tone="danger"
                            disabled={busy}
                            label={`Remove ${file.name}`}
                            onClick={() => setRemoving([file])}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !visible.length && (
            <p className="py-10 text-center text-sm italic text-slate-500 dark:text-slate-400">
              {query ? 'No files match your search.' : 'No files uploaded.'}
            </p>
          )}
        </div>
        <Pagination page={page} total={data.total} change={setPage} />
      </div>

      {confirmClose && (
        <ConfirmDialog
          title="Uploads in progress"
          tone="warning"
          confirmLabel="Close anyway"
          message="Files are still uploading. They will keep processing in the background; reopen this window later to see their status."
          onCancel={() => setConfirmClose(false)}
          onConfirm={close}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={removing.length === 1 ? 'Remove file' : 'Remove files'}
          message={
            <>
              Remove{' '}
              <strong>
                {removing.length === 1
                  ? `“${removing[0].name}”`
                  : `${removing.length} files`}
              </strong>{' '}
              from future chat answers? Existing answers and source excerpts
              will remain.
            </>
          }
          confirmLabel={removing.length === 1 ? 'Remove file' : 'Remove files'}
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void remove(removing)}
        />
      )}
    </Modal>
  );
}
