import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Calendar,
  Files,
  Pencil,
  Plus,
  Search,
  Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Page, Semester, SemesterInput } from '../../types';
import { Modal } from '../common/ui/Modal';
import { Button } from '../common/ui/Button';
import { Badge } from '../common/ui/Badge';
import { Card, PageHeader, SearchInput } from '../common/ui/Card';
import { ConfirmDialog } from '../common/ui/ConfirmDialog';
import { Pagination } from '../common/ui/Pagination';
import { SortableHeader } from '../common/ui/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import { formatDate } from '../../utils/formatters';
import { SemesterFiles } from './SemesterFiles';
import { SemesterSupervisors } from './SemesterSupervisors';
import { errorMessage, inputClass, labelClass, thClass } from './semesterShared';

const formatPeriod = (semester: Semester) => {
  const { start_date: start, end_date: end } = semester;
  if (!start && !end) return '—';
  return `${start ? formatDate(start) : '…'} – ${end ? formatDate(end) : '…'}`;
};

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
    semester
      ? {
          name: semester.name,
          year: semester.year,
          start_date: semester.start_date,
          end_date: semester.end_date
        }
      : {
          name: '',
          year: new Date().getFullYear(),
          start_date: null,
          end_date: null
        }
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const formId = 'semester-form';

  return (
    <Modal
      title={semester ? 'Edit semester' : 'Create semester'}
      icon={<Calendar className="w-4 h-4" />}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={busy}>
            {busy ? 'Saving…' : 'Save semester'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
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
                start_date: values.start_date || null,
                end_date: values.end_date || null
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
          <p
            role="alert"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
          >
            {error}
          </p>
        )}
        <label className="block">
          <span className={labelClass}>Name *</span>
          <input
            autoFocus
            required
            maxLength={255}
            className={inputClass}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Year *</span>
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
          <label className="block">
            <span className={labelClass}>Start date</span>
            <input
              type="date"
              className={inputClass}
              value={values.start_date ?? ''}
              onChange={(e) =>
                setValues({ ...values, start_date: e.target.value || null })
              }
            />
          </label>
          <label className="block">
            <span className={labelClass}>End date</span>
            <input
              type="date"
              min={values.start_date || undefined}
              className={inputClass}
              value={values.end_date ?? ''}
              onChange={(e) =>
                setValues({ ...values, end_date: e.target.value || null })
              }
            />
          </label>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Dates are optional and describe the academic period. Archive the
          semester to make chat read-only.
        </p>
      </form>
    </Modal>
  );
}

const actionClass =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer';
const neutralAction = `${actionClass} border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:border-blue-800 dark:hover:text-blue-400 dark:hover:bg-blue-950/40`;
const archiveAction = `${actionClass} border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40`;

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
  const [archiveError, setArchiveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { sort, toggleSort } = useTableSort(null, () => setPage(1));
  const [dialog, setDialog] = useState<{
    kind: 'edit' | 'files' | 'supervisors' | 'archive';
    semester?: Semester;
  } | null>(null);
  const close = useCallback(() => {
    setDialog(null);
    setArchiveError('');
  }, []);
  // `full` also reloads shared admin data; per-file upload updates only need the counts here.
  const changed = async (full = true) => {
    setRevision((v) => v + 1);
    if (full) await refreshAdminData();
  };
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listSemesters(archived, search, page, sort)
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
  }, [api, archived, search, page, sort, revision]);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Semesters"
        subtitle="Manage teaching periods, shared documents, and supervisor assignments."
        icon={<Calendar className="w-5 h-5" />}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setDialog({ kind: 'edit' })}
          >
            Add semester
          </Button>
        }
      />

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <SearchInput
          icon={<Search size={16} />}
          aria-label="Search semesters"
          maxLength={100}
          placeholder="Search semesters…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1"
        />
        <select
          aria-label="Semester status"
          className={`${inputClass} sm:w-56`}
          value={String(archived)}
          onChange={(e) => {
            setArchived(e.target.value === 'true');
            setPage(1);
          }}
        >
          <option value="false">Active semesters</option>
          <option value="true">Archived semesters</option>
        </select>
      </Card>

      {error && (
        <p
          role="alert"
          className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <Card className="overflow-x-auto">
        {/* Only the first load shows a placeholder; refreshes keep the table in place. */}
        {loading && !data.items.length ? (
          <p className="p-6 text-sm text-slate-500">Loading semesters…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <SortableHeader label="Semester" field="name" sort={sort} onSort={toggleSort} className={thClass} />
                <SortableHeader label="Period" field="start_date" sort={sort} onSort={toggleSort} className={thClass} />
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.items.map((semester) => (
                <tr
                  key={semester.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {semester.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {semester.year}
                    </p>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                    {formatPeriod(semester)}
                  </td>
                  <td className="px-4 py-4">
                    {semester.deleted_at ? (
                      <Badge>Archived</Badge>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        aria-label={`Manage files for ${semester.name}`}
                        title="Manage files"
                        className={neutralAction}
                        onClick={() => setDialog({ kind: 'files', semester })}
                      >
                        <Files size={14} />
                        Files
                        <span className="px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">
                          {semester.file_count ?? 0}
                        </span>
                      </button>
                      <button
                        aria-label={`Manage supervisors for ${semester.name}`}
                        title="Manage supervisors"
                        className={neutralAction}
                        onClick={() =>
                          setDialog({ kind: 'supervisors', semester })
                        }
                      >
                        <Users size={14} />
                        Supervisors
                        <span className="px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">
                          {semester.supervisor_count ?? 0}
                        </span>
                      </button>
                      {!semester.deleted_at && (
                        <>
                          <button
                            aria-label={`Edit ${semester.name}`}
                            title="Edit semester"
                            className={neutralAction}
                            onClick={() =>
                              setDialog({ kind: 'edit', semester })
                            }
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            aria-label={`Archive ${semester.name}`}
                            title="Archive semester"
                            className={archiveAction}
                            onClick={() =>
                              setDialog({ kind: 'archive', semester })
                            }
                          >
                            <Archive size={14} />
                            Archive
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
          <div className="py-14 text-center space-y-2">
            <Calendar className="mx-auto text-slate-300 dark:text-slate-600" size={32} />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No semesters found. Create a semester before adding supervisors.
            </p>
          </div>
        )}
      </Card>
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
        <ConfirmDialog
          title="Archive semester"
          tone="warning"
          confirmLabel="Archive semester"
          busy={busy}
          error={archiveError}
          message={
            <>
              Archive <strong>“{dialog.semester.name}”</strong>? Assigned
              supervisors will only be able to read their history and download
              cited files. They can be moved to another active semester later.
            </>
          }
          onCancel={close}
          onConfirm={async () => {
            setBusy(true);
            setArchiveError('');
            try {
              await api.archiveSemester(dialog.semester!.id);
              await changed();
              close();
            } catch (error) {
              setArchiveError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
};
