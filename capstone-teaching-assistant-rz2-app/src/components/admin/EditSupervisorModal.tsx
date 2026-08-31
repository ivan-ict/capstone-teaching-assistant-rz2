import React, { useState, useEffect } from 'react';
import { X, Edit2, ShieldAlert, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';

interface EditSupervisorModalProps {
  supervisor: User;
  onClose: () => void;
}

export const EditSupervisorModal: React.FC<EditSupervisorModalProps> = ({ supervisor, onClose }) => {
  const { faculties, updateSupervisor, supervisors } = useApp();

  const [formData, setFormData] = useState({
    firstName: supervisor.firstName || '',
    lastName: supervisor.lastName || '',
    username: supervisor.username || '',
    email: supervisor.email || '',
    phone: supervisor.phone || '',
    faculty: supervisor.faculty || faculties[0]?.name || 'Computer Science',
    teachingYear: supervisor.teachingYear || '2026',
    teachingSemester: supervisor.teachingSemester || 'Semester 1',
  });

  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    setFormData({
      firstName: supervisor.firstName || '',
      lastName: supervisor.lastName || '',
      username: supervisor.username || '',
      email: supervisor.email || '',
      phone: supervisor.phone || '',
      faculty: supervisor.faculty || faculties[0]?.name || 'Computer Science',
      teachingYear: supervisor.teachingYear || '2026',
      teachingSemester: supervisor.teachingSemester || 'Semester 1',
    });
  }, [supervisor, faculties]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = formData.username.trim();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !cleanUsername) {
      setError('Please fill in all required fields.');
      return;
    }

    // Check if username is already taken by another supervisor
    const isDuplicateUsername = supervisors.some(s => s.id !== supervisor.id && s.username.toLowerCase() === cleanUsername.toLowerCase());
    if (isDuplicateUsername) {
      setError(`Username "${cleanUsername}" is already taken by another supervisor.`);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    const result = await updateSupervisor(supervisor.id, {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      faculty: formData.faculty,
      teachingYear: formData.teachingYear,
      teachingSemester: formData.teachingSemester,
    });
    if (!result.success) {
      setError(result.message || 'Could not update supervisor.');
      return;
    }

    setIsSuccess(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div 
      id="edit-supervisor-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
    >
      <div 
        id="edit-supervisor-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Edit Supervisor Information
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update account and institutional allocation details for @{supervisor.username}
              </p>
            </div>
          </div>
          <button
            id="close-edit-supervisor-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Supervisor information updated successfully!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Name *
              </label>
              <input
                id="edit-supervisor-first-name"
                type="text"
                required
                placeholder="e.g. Ivan"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Last Name *
              </label>
              <input
                id="edit-supervisor-last-name"
                type="text"
                required
                placeholder="e.g. Trinh"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Username *
              </label>
              <input
                id="edit-supervisor-username"
                type="text"
                readOnly
                placeholder="e.g. ivantrinh"
                value={formData.username}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                id="edit-supervisor-email"
                type="email"
                required
                placeholder="e.g. i.trinh@swin.edu.au"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                id="edit-supervisor-phone"
                type="tel"
                placeholder="e.g. +61 412 345 678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Faculty Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Faculty Assignment *
              </label>
              <select
                id="edit-supervisor-faculty"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer"
              >
                {faculties.map((fac) => (
                  <option key={fac.id} value={fac.name}>
                    {fac.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Teaching Academic Year */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Academic Year *
              </label>
              <select
                id="edit-supervisor-teaching-year"
                value={formData.teachingYear}
                onChange={(e) => setFormData({ ...formData, teachingYear: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer"
              >
                <option value="2030">2030</option>
                <option value="2029">2029</option>
                <option value="2028">2028</option>
                <option value="2027">2027</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
              </select>
            </div>

            {/* Teaching Semester */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Academic Semester *
              </label>
              <select
                id="edit-supervisor-teaching-semester"
                value={formData.teachingSemester}
                onChange={(e) => setFormData({ ...formData, teachingSemester: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer"
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
              </select>
            </div>
          </div>

          {/* Modal Footer / Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              id="cancel-edit-supervisor-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-edit-supervisor-btn"
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
