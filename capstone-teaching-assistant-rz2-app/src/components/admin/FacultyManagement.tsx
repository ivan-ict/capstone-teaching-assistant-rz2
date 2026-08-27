import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Users, 
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Faculty } from '../../types';
import { formatDate } from '../../utils/formatters';

export const FacultyManagement: React.FC = () => {
  const { 
    faculties, 
    supervisors, 
    addFaculty, 
    updateFaculty, 
    deleteFaculty 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [currentFaculty, setCurrentFaculty] = useState<Faculty | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [deleteTarget, setDeleteTarget] = useState<Faculty | null>(null);

  // Compute supervisor count per faculty (total assigned supervisors with active/suspended breakdown)
  const facultyListWithCounts = faculties.map(f => {
    const totalCount = supervisors.filter(s => s.faculty === f.name).length;
    const activeCount = supervisors.filter(s => s.faculty === f.name && s.status === 'active').length;
    const suspendedCount = totalCount - activeCount;
    return { 
      ...f, 
      activeSupervisorsCount: activeCount, 
      suspendedSupervisorsCount: suspendedCount,
      totalSupervisorsCount: totalCount 
    };
  });

  const filteredFaculties = facultyListWithCounts.filter(f => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return f.name.toLowerCase().includes(q);
  });

  const handleOpenAdd = () => {
    setFormData({ name: '' });
    setCurrentFaculty(null);
    setModalMode('add');
  };

  const handleOpenEdit = (fac: Faculty) => {
    setFormData({ name: fac.name });
    setCurrentFaculty(fac);
    setModalMode('edit');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    if (!cleanName) return;

    // Generate a fallback code for internal key/tag if new
    const words = cleanName.split(/\s+/).filter(Boolean);
    const generatedCode = words.length > 1 
      ? words.map(w => w[0]).join('').toUpperCase().slice(0, 5)
      : cleanName.slice(0, 4).toUpperCase();

    if (modalMode === 'add') {
      addFaculty({
        name: cleanName,
        code: generatedCode,
        departmentHead: 'Unassigned',
      });
    } else if (modalMode === 'edit' && currentFaculty) {
      updateFaculty(currentFaculty.id, {
        name: cleanName,
      });
    }

    setModalMode(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-blue-600" />
            Faculty Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage academic faculties and capstone cohort allocations.
          </p>
        </div>

        <button
          id="add-faculty-btn"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Faculty</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="faculty-search-input"
            type="text"
            placeholder="Search by faculty name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table Card View - Consistent Typography, Icon Alignment, and Slim Custom Scrollbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table id="faculty-management-table" className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px] select-none">
              <tr>
                <th className="py-3.5 px-4">Faculty Name</th>
                <th className="py-3.5 px-4">Supervisors</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredFaculties.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 italic">
                    No faculties found matching the query.
                  </td>
                </tr>
              ) : (
                filteredFaculties.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {f.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-200/60 dark:border-emerald-800/60 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{f.activeSupervisorsCount} Active</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-medium border border-amber-200/60 dark:border-amber-800/60 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>{f.suspendedSupervisorsCount} Suspended</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {formatDate(f.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`edit-faculty-btn-${f.id}`}
                          onClick={() => handleOpenEdit(f)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                          title="Edit Faculty"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        {f.totalSupervisorsCount > 0 ? (
                          <button
                            id={`delete-faculty-btn-${f.id}`}
                            disabled
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 text-xs font-semibold border border-slate-200/80 dark:border-slate-800 cursor-not-allowed opacity-60"
                            title={`Cannot delete faculty: ${f.totalSupervisorsCount} supervisor${f.totalSupervisorsCount > 1 ? 's' : ''} assigned (${f.activeSupervisorsCount} active${f.suspendedSupervisorsCount > 0 ? `, ${f.suspendedSupervisorsCount} suspended` : ''}).`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <button
                            id={`delete-faculty-btn-${f.id}`}
                            onClick={() => setDeleteTarget(f)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                            title="Delete Faculty"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalMode && (
        <div 
          id="faculty-form-modal-backdrop"
          onClick={() => setModalMode(null)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div 
            id="faculty-form-modal"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {modalMode === 'add' ? 'Add New Faculty' : 'Edit Faculty'}
                </h3>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty Name *
                </label>
                <input
                  id="faculty-name-input"
                  type="text"
                  required
                  placeholder="e.g. Computer Science"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="save-faculty-submit-btn"
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  {modalMode === 'add' ? 'Create Faculty' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div 
          id="delete-faculty-modal-backdrop"
          onClick={() => setDeleteTarget(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div 
            id="delete-faculty-modal"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Faculty</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">"{deleteTarget.name}"</span>?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                id="cancel-delete-faculty-btn"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-faculty-action-btn"
                onClick={() => {
                  deleteFaculty(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
