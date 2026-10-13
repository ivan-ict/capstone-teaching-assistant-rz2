import React, { useEffect, useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Page, Semester, SemesterSupervisor } from '../../types';
import { getInitials } from '../../utils/formatters';
import { Modal } from '../common/ui/Modal';
import { Button } from '../common/ui/Button';
import { Badge } from '../common/ui/Badge';
import { SearchInput } from '../common/ui/Card';
import { Pagination } from '../common/ui/Pagination';
import { SortableHeader } from '../common/ui/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import { errorMessage, thClass } from './semesterShared';

export function SemesterSupervisors({
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
  const { sort, toggleSort } = useTableSort({ by: 'username', order: 'asc' }, () => setPage(1));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .semesterSupervisors(semester.id, candidates, search, page, sort)
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
  }, [api, semester.id, candidates, search, page, sort, revision]);

  const switchMode = (next: boolean) => {
    setCandidates(next);
    setPage(1);
    setSelected([]);
  };

  const tab = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${active ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`;

  const assign = async () => {
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
  };

  return (
    <Modal
      title={`Supervisors · ${semester.name}`}
      icon={<Users className="w-4 h-4" />}
      size="lg"
      onClose={close}
      footer={
        candidates ? (
          <>
            <span className="mr-auto text-xs text-slate-500 dark:text-slate-400">
              {selected.length} selected
            </span>
            <Button variant="ghost" onClick={() => switchMode(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<UserPlus size={16} />}
              disabled={busy || !selected.length}
              onClick={() => void assign()}
            >
              {busy ? 'Moving…' : `Move ${selected.length} supervisors here`}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start">
            <button
              className={tab(!candidates)}
              aria-pressed={!candidates}
              onClick={() => switchMode(false)}
            >
              <Users size={14} />
              Current supervisors
            </button>
            {!semester.deleted_at && (
              <button
                className={tab(candidates)}
                aria-pressed={candidates}
                onClick={() => switchMode(true)}
              >
                <UserPlus size={14} />
                Add supervisors
              </button>
            )}
          </div>
          <SearchInput
            icon={<Search size={16} />}
            aria-label="Search supervisors"
            maxLength={100}
            placeholder="Search supervisors…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1"
          />
        </div>
        {candidates && (
          <p className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200">
            Only active supervisors outside this semester are listed. Adding
            them moves their assignment here; their earlier conversations stay
            in their original semester.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300"
          >
            {error}
          </p>
        )}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {loading && !data.items.length ? (
            <p className="p-6 text-sm text-slate-500">Loading supervisors…</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  {candidates && <th className="pl-4 py-3 w-8" />}
                  <SortableHeader label="Supervisor" field="username" sort={sort} onSort={toggleSort} className={thClass} />
                  <SortableHeader label="Status" field="status" sort={sort} onSort={toggleSort} className={thClass} />
                  <SortableHeader label="Current semester" field="semester" sort={sort} onSort={toggleSort} className={thClass} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.items.map((user) => {
                  const checked = selected.includes(user.id);
                  return (
                    <tr
                      key={user.id}
                      className={
                        checked
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }
                    >
                      {candidates && (
                        <td className="pl-4 py-3">
                          <input
                            aria-label={`Select ${user.username}`}
                            type="checkbox"
                            className="accent-blue-600"
                            disabled={
                              busy || (!checked && selected.length >= 100)
                            }
                            checked={checked}
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {getInitials(`${user.first_name} ${user.last_name}`)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-xs text-slate-400 font-mono truncate">
                              @{user.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.status === 'ACTIVE' ? (
                          <Badge tone="green">Active</Badge>
                        ) : (
                          <Badge>Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={user.semester.deleted_at ? 'slate' : 'blue'}>
                          {user.semester.name}
                          {user.semester.deleted_at && ' (archived)'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && !data.items.length && (
            <p className="py-10 text-center text-sm italic text-slate-500 dark:text-slate-400">
              No matching supervisors.
            </p>
          )}
        </div>
        <Pagination page={page} total={data.total} change={setPage} />
      </div>
    </Modal>
  );
}
