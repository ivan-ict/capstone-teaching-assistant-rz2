import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Phone, 
  Calendar, 
  Shield, 
  Building2, 
  KeyRound, 
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDate, getInitials } from '../../utils/formatters';

export const ProfileModal: React.FC = () => {
  const { 
    currentUser, 
    isProfileModalOpen, 
    setIsProfileModalOpen, 
    changeCurrentUserPassword,
    faculties 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  
  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset when modal opens or user changes
  useEffect(() => {
    if (isProfileModalOpen) {
      setActiveTab('profile');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isProfileModalOpen, currentUser]);

  if (!isProfileModalOpen || !currentUser) return null;

  const initialChar = getInitials(currentUser.firstName || currentUser.fullName || 'U');

  // Find matching faculty object
  const currentFacultyObj = faculties.find(
    f => f.name.toLowerCase() === (currentUser.faculty || '').toLowerCase() ||
         f.id === currentUser.faculty ||
         f.code.toLowerCase() === (currentUser.faculty || '').toLowerCase()
  );

  const handleClose = () => {
    setIsProfileModalOpen(false);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword.trim()) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    if (!newPassword.trim()) {
      setErrorMsg('Please enter a new password.');
      return;
    }

    if (newPassword.length < 9) {
      setErrorMsg('New password must be at least 9 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMsg('New password must be different from your current password.');
      return;
    }

    setIsSubmitting(true);
    const result = await changeCurrentUserPassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMsg(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMsg('');
        setActiveTab('profile');
      }, 1500);
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div 
      id="profile-modal-backdrop"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div 
        id="profile-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Header with avatar banner */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 pt-6 pb-12 relative text-white shrink-0">
          <button
            id="profile-modal-close-icon"
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <h2 className="text-lg font-bold tracking-tight">
            Supervisor Account
          </h2>
          <p className="text-xs text-blue-100/90">
            Account overview, teaching allocation & security credentials
          </p>
        </div>

        {/* Floating Avatar and Tab Selector */}
        <div className="px-6 -mt-8 relative z-10 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              {/* Account initial circle */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-2xl uppercase shadow-lg border-4 border-white dark:border-slate-900 shrink-0">
                {initialChar}
              </div>
              <div className="mb-1 min-w-0">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight truncate">
                  {currentUser.fullName || `${currentUser.firstName} ${currentUser.lastName}`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                  @{currentUser.username}
                </p>
              </div>
            </div>

            {/* Tab switch buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto shrink-0">
              <button
                id="profile-tab-details"
                onClick={() => setActiveTab('profile')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'profile'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Profile</span>
              </button>
              <button
                id="profile-tab-password"
                onClick={() => setActiveTab('password')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'password'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Change Password</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === 'profile' ? (
            /* READ-ONLY SUPERVISOR PROFILE DETAILS */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Account Role & Status */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tracking-wider">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    <span>Role & Status</span>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {currentUser.role}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {currentUser.status}
                    </span>
                  </div>
                </div>

                {/* Faculty */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tracking-wider">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Faculty</span>
                  </div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold truncate">
                    {currentFacultyObj ? currentFacultyObj.name : (currentUser.faculty || 'Computer Science')}
                  </div>
                </div>

                {/* Email */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tracking-wider">
                    <Mail className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Email Address</span>
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 font-medium truncate">
                    {currentUser.email}
                  </div>
                </div>

                {/* Phone */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tracking-wider">
                    <Phone className="w-3.5 h-3.5 text-amber-500" />
                    <span>Phone Number</span>
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 font-mono">
                    {currentUser.phone || 'Not specified'}
                  </div>
                </div>

                {/* Teaching Term */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5 sm:col-span-2">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-purple-500" />
                    <span>Academic Allocation</span>
                  </div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                      {currentUser.teachingYear || '2026'}
                    </span>
                    <span className="text-slate-400">&bull;</span>
                    <span>{currentUser.teachingSemester || 'Semester 1'}</span>
                  </div>
                </div>
              </div>

              {/* Information Note */}
              <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex items-start gap-2.5 text-[11px] text-blue-800 dark:text-blue-300">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Profile data is administered centrally. To update your faculty allocation or academic term, please contact your administrator.
                </span>
              </div>
            </div>
          ) : (
            /* CHANGE PASSWORD FORM */
            <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 font-medium animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Current Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="current-password-input"
                    type={showCurrentPw ? 'text' : 'password'}
                    required
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password-input"
                    type={showNewPw ? 'text' : 'password'}
                    required
                    placeholder="Enter new password (min. 9 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-new-password-input"
                    type={showConfirmPw ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-change-password-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <span>Member since {formatDate(currentUser.createdAt)}</span>
          <button
            id="profile-modal-close-footer-btn"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 transition shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
