import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Plus,
  X,
  Files,
  Users,
  Pencil,
  Archive,
  Download,
  Trash2,
  Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  AttachedFile,
  Page,
  Semester,
  SemesterInput,
  SemesterSupervisor
} from '../../types';
import { formatBytes } from '../../utils/formatters';
import { SUPPORTED_UPLOAD_ACCEPT } from '../../constants/files';

const inputClass =
  'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm';
const buttonClass =
  'px-3 py-2 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40';
const primaryClass =
  'px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40';
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The operation failed.';

function Dialog({
  title,
  close,
  children
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800"
      >
        <header className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-bold">{title}</h2>
          <button aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </header>
        <div className="p-5 space-y-4">{children}</div>
      </section>
    </div>
  );
}

function Pagination({
  page,
  total,
  change
}: {
  page: number;
  total: number;
  change: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3 text-xs">
      <span>
        {total} total · Page {page} of {Math.max(1, Math.ceil(total / 20))}
      </span>
      <button
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => change(page - 1)}
      >
        Previous
      </button>
      <button
        className={buttonClass}
        disabled={page * 20 >= total}
        onClick={() => change(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

function SemesterForm({
  semester,
  close,
  saved
}: {
  semester?: Semester;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const { api } = useApp();
  const [values, setValues] = useState<SemesterInput>(
    semester || {
      name: '',
      year: new Date().getFullYear(),
      start_date: '',
      end_date: ''
    }
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={semester ? 'Edit semester' : 'Create semester'}
      close={close}
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api.saveSemester(
              {
                name: values.name.trim(),
                year: Number(values.year),
                start_date: values.start_date,
                end_date: values.end_date
              },
              semester?.id
            );
            await saved();
            close();
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="text-rose-600 text-sm">
            {error}
          </p>
        )}
        <label className="block text-sm">
          Name *
          <input
            autoFocus
            required
            maxLength={255}
            className={inputClass}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Year *
          <input
            required
            type="number"
            min={2000}
            max={2100}
            className={inputClass}
            value={values.year}
            onChange={(e) =>
              setValues({ ...values, year: Number(e.target.value) })
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Start date *
            <input
              required
              type="date"
              className={inputClass}
              value={values.start_date}
              onChange={(e) =>
                setValues({ ...values, start_date: e.target.value })
              }
            />
          </label>
          <label className="text-sm">
            End date *
            <input
              required
              type="date"
              min={values.start_date}
              className={inputClass}
              value={values.end_date}
              onChange={(e) =>
                setValues({ ...values, end_date: e.target.value })
              }
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Dates describe the academic period. Archive the semester to make chat
          read-only.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass} onClick={close}>
            Cancel
          </button>
          <button className={primaryClass} disabled={busy}>
            {busy ? 'Saving…' : 'Save semester'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function SemesterFiles({
  semester,
  close,
  changed
}: {
  semester: Semester;
  close: () => void;
  changed: () => Promise<void>;
}) {
  const { api, downloadFile, previewFile } = useApp();
  const [data, setData] = useState<Page<AttachedFile>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20
  });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [removing, setRemoving] = useState<AttachedFile | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .semesterFiles(semester.id, page)
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
  }, [api, semester.id, page, revision]);
  const upload = async (files: File[]) => {
    setBusy(true);
    setError('');
    const failures: string[] = [];
    try {
      for (const file of files) {
        try {
          await api.uploadSemesterFile(semester.id, file);
        } catch (error) {
          failures.push(`${file.name}: ${errorMessage(error)}`);
        }
      }
      setPage(1);
      setRevision((v) => v + 1);
      await changed();
    } catch (error) {
      failures.push(errorMessage(error));
    } finally {
      setError(failures.join('\n'));
      setBusy(false);
    }
  };
  return (
    <Dialog title={`Files · ${semester.name}`} close={close}>
      {semester.deleted_at ? (
        <p className="text-sm text-amber-600">
          Archived semester. Files are read-only.
        </p>
      ) : (
        <label className="block text-sm">
          Upload files
          <input
            aria-label="Upload semester files"
            type="file"
            multiple
            accept={SUPPORTED_UPLOAD_ACCEPT}
            disabled={busy}
            className="block mt-2 text-sm"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = '';
              if (files.length) void upload(files);
            }}
          />
        </label>
      )}
      {busy && (
        <p role="status" className="text-sm">
          Processing files…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600 whitespace-pre-wrap">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading files…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="p-2">File</th>
                <th>Size</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((file) => (
                <tr
                  key={file.id}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="p-2 max-w-56 break-words">
                    {file.name}
                    {file.processingError && (
                      <p className="text-rose-600">{file.processingError}</p>
                    )}
                  </td>
                  <td>{formatBytes(file.size)}</td>
                  <td>{file.processingStatus}</td>
                  <td>{new Date(file.uploadedAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-2 p-2">
                      <button
                        aria-label={`Preview ${file.name}`}
                        onClick={() => previewFile(file)}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        aria-label={`Download ${file.name}`}
                        onClick={() => void downloadFile(file)}
                      >
                        <Download size={16} />
                      </button>
                      {!semester.deleted_at && (
                        <button
                          disabled={busy}
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setRemoving(file)}
                        >
                          <Trash2 size={16} className="text-rose-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.items.length && (
            <p className="py-6 text-center text-sm text-slate-500">
              No files uploaded.
            </p>
          )}
        </div>
      )}
      {removing && (
        <div className="rounded-xl border border-rose-200 p-3 text-sm">
          <p>
            Remove “{removing.name}” from future chat answers? Existing answers
            and source excerpts will remain.
          </p>
          <div className="flex justify-end">
            <button className={buttonClass} onClick={() => setRemoving(null)}>
              Cancel
            </button>
            <button
              className={buttonClass}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api.deleteSemesterFile(semester.id, removing.id);
                  setRemoving(null);
                  setPage(1);
                  setRevision((v) => v + 1);
                  await changed();
                } catch (error) {
                  setError(errorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove file
            </button>
          </div>
        </div>
      )}
      <Pagination page={page} total={data.total} change={setPage} />
    </Dialog>
  );
}

function SemesterSupervisors({
  semester,
  close,
  changed
}: {
  semester: Semester;
  close: () => void;
  changed: () => Promise<void>;
}) {
  const { api } = useApp();
  const [candidates, setCandidates] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<SemesterSupervisor>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .semesterSupervisors(semester.id, candidates, search, page)
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
  }, [api, semester.id, candidates, search, page, revision]);
  return (
    <Dialog title={`Supervisors · ${semester.name}`} close={close}>
      <div className="flex gap-2">
        <button
          className={buttonClass}
          aria-pressed={!candidates}
          onClick={() => {
            setCandidates(false);
            setPage(1);
            setSelected([]);
          }}
        >
          Current supervisors
        </button>
        {!semester.deleted_at && (
          <button
            className={buttonClass}
            aria-pressed={candidates}
            onClick={() => {
              setCandidates(true);
              setPage(1);
            }}
          >
            Add supervisors
          </button>
        )}
      </div>
      {candidates && (
        <p className="text-sm text-slate-500">
          Only active supervisors outside this semester are listed. Adding them
          moves their assignment here; their earlier conversations stay in their
          original semester.
        </p>
      )}
      <input
        aria-label="Search supervisors"
        maxLength={100}
        className={inputClass}
        placeholder="Search supervisors…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {error && (
        <p role="alert" className="text-rose-600 text-sm">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading supervisors…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {candidates && <th>Select</th>}
                <th className="p-2">Supervisor</th>
                <th>Status</th>
                <th>Current semester</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  {candidates && (
                    <td>
                      <input
                        aria-label={`Select ${user.username}`}
                        type="checkbox"
                        disabled={
                          busy ||
                          (!selected.includes(user.id) &&
                            selected.length >= 100)
                        }
                        checked={selected.includes(user.id)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, user.id]
                              : prev.filter((id) => id !== user.id)
                          )
                        }
                      />
                    </td>
                  )}
                  <td className="p-2">
                    {user.first_name} {user.last_name}
                    <span className="block text-xs text-slate-400">
                      @{user.username}
                    </span>
                  </td>
                  <td>{user.status === 'ACTIVE' ? 'Active' : 'Inactive'}</td>
                  <td>
                    {user.semester.name}
                    {user.semester.deleted_at && ' (archived)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.items.length && (
            <p className="py-6 text-center text-slate-500">
              No matching supervisors.
            </p>
          )}
        </div>
      )}
      <Pagination page={page} total={data.total} change={setPage} />
      {candidates && (
        <div className="flex justify-end">
          <button
            disabled={busy || !selected.length}
            className={primaryClass}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await api.assignSupervisors(semester.id, selected);
                setSelected([]);
                setCandidates(false);
                setSearch('');
                setPage(1);
                await changed();
              } catch (error) {
                setError(errorMessage(error));
                setSelected([]);
              } finally {
                setRevision((v) => v + 1);
                setBusy(false);
              }
            }}
          >
            {busy ? 'Moving…' : `Move ${selected.length} supervisors here`}
          </button>
        </div>
      )}
    </Dialog>
  );
}

export const SemesterManagement: React.FC = () => {
  const { api, refreshAdminData } = useApp();
  const [data, setData] = useState<Page<Semester>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20
  });
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{
    kind: 'edit' | 'files' | 'supervisors' | 'archive';
    semester?: Semester;
  } | null>(null);
  const close = useCallback(() => setDialog(null), []);
  const changed = async () => {
    setRevision((v) => v + 1);
    await refreshAdminData();
  };
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listSemesters(archived, search, page)
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
  }, [api, archived, search, page, revision]);
  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex gap-2 items-center">
            <Calendar className="text-blue-600" />
            Semesters
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage teaching periods, shared documents, and supervisor
            assignments.
          </p>
        </div>
        <button
          className={primaryClass}
          onClick={() => setDialog({ kind: 'edit' })}
        >
          <Plus size={16} className="inline mr-1" />
          Add semester
        </button>
      </div>
      <div className="flex gap-3">
        <input
          aria-label="Search semesters"
          maxLength={100}
          className={inputClass}
          placeholder="Search semesters…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Semester status"
          className={inputClass}
          value={String(archived)}
          onChange={(e) => {
            setArchived(e.target.value === 'true');
            setPage(1);
          }}
        >
          <option value="false">Active semesters</option>
          <option value="true">Archived semesters</option>
        </select>
      </div>
      {error && (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      )}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
        {loading ? (
          <p className="p-6">Loading semesters…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500">
              <tr>
                {[
                  'Semester',
                  'Year',
                  'Dates',
                  'Status',
                  'Files',
                  'Supervisors',
                  'Actions'
                ].map((label) => (
                  <th key={label} className="p-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((semester) => (
                <tr
                  key={semester.id}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="p-4 font-semibold">{semester.name}</td>
                  <td className="p-4">{semester.year}</td>
                  <td className="p-4 whitespace-nowrap text-xs">
                    {semester.start_date} – {semester.end_date}
                  </td>
                  <td className="p-4">
                    {semester.deleted_at ? 'Archived' : 'Active'}
                  </td>
                  <td className="p-4">{semester.file_count}</td>
                  <td className="p-4">{semester.supervisor_count}</td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <button
                        aria-label={`Manage files for ${semester.name}`}
                        title="Manage files"
                        onClick={() => setDialog({ kind: 'files', semester })}
                      >
                        <Files size={17} />
                      </button>
                      <button
                        aria-label={`Manage supervisors for ${semester.name}`}
                        title="Manage supervisors"
                        onClick={() =>
                          setDialog({ kind: 'supervisors', semester })
                        }
                      >
                        <Users size={17} />
                      </button>
                      {!semester.deleted_at && (
                        <>
                          <button
                            aria-label={`Edit ${semester.name}`}
                            title="Edit semester"
                            onClick={() =>
                              setDialog({ kind: 'edit', semester })
                            }
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            aria-label={`Archive ${semester.name}`}
                            title="Archive semester"
                            onClick={() =>
                              setDialog({ kind: 'archive', semester })
                            }
                          >
                            <Archive size={17} className="text-amber-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !data.items.length && (
          <p className="text-center py-12 text-slate-500">
            No semesters found. Create a semester before adding supervisors.
          </p>
        )}
      </div>
      <Pagination page={page} total={data.total} change={setPage} />
      {dialog?.kind === 'edit' && (
        <SemesterForm
          semester={dialog.semester}
          close={close}
          saved={changed}
        />
      )}
      {dialog?.kind === 'files' && dialog.semester && (
        <SemesterFiles
          semester={dialog.semester}
          close={close}
          changed={changed}
        />
      )}
      {dialog?.kind === 'supervisors' && dialog.semester && (
        <SemesterSupervisors
          semester={dialog.semester}
          close={close}
          changed={changed}
        />
      )}
      {dialog?.kind === 'archive' && dialog.semester && (
        <Dialog title="Archive semester" close={close}>
          <p className="text-sm">
            Archive “{dialog.semester.name}”? Assigned supervisors will only be
            able to read their history and download cited files. They can be
            moved to another active semester later.
          </p>
          {error && (
            <p role="alert" className="text-rose-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className={buttonClass} onClick={close}>
              Cancel
            </button>
            <button
              className={primaryClass}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api.archiveSemester(dialog.semester!.id);
                  await changed();
                  close();
                } catch (error) {
                  setError(errorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Archive semester
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
};
