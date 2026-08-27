import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  KeyRound, 
  UserCheck, 
  UserX, 
  Users, 
  RotateCcw,
  Building2,
  Calendar,
  Mail,
  Phone,
  Check,
  ChevronDown,
  X,
  ShieldAlert,
  Edit2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { formatDate, formatDateTime, getInitials } from '../../utils/formatters';
import { AddSupervisorModal } from './AddSupervisorModal';
import { EditSupervisorModal } from './EditSupervisorModal';
import { ChangePasswordModal } from './ChangePasswordModal';

type SortField = 'fullName' | 'username' | 'faculty' | 'teachingYear' | 'teachingSemester' | 'email' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type SearchScope = 'all' | 'name' | 'username' | 'email' | 'phone';

export const SupervisorManagement: React.FC = () => {
  const { 
    supervisors, 
    faculties, 
    suspendSupervisor, 
    activateSupervisor 
  } = useApp();

  // Tab: active vs suspended
  const [activeTab, setActiveTab] = useState<'active' | 'suspended'>('active');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');

  // Multi-select filter states
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedSemesters, setSelectedSemesters] = useState<string[]>([]);

  // Filter dropdown toggle popovers
  const [isFacultyDropdownOpen, setIsFacultyDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isSemesterDropdownOpen, setIsSemesterDropdownOpen] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [passwordChangeTarget, setPasswordChangeTarget] = useState<User | null>(null);

  // Confirmation dialogs state
  const [confirmSuspendUser, setConfirmSuspendUser] = useState<User | null>(null);
  const [confirmActivateUser, setConfirmActivateUser] = useState<User | null>(null);

  // Close dropdowns on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFacultyDropdownOpen(false);
        setIsYearDropdownOpen(false);
        setIsSemesterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Available unique options for filters
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(supervisors.map(s => s.teachingYear).filter(Boolean)));
    const baseYears = ['2030', '2029', '2028', '2027', '2026', '2025', '2024', '2023', '2022'];
    return Array.from(new Set([...baseYears, ...years])).sort((a, b) => Number(b) - Number(a));
  }, [supervisors]);

  const availableSemesters = ['Semester 1', 'Semester 2'];

  // Toggle multi-select item
  const toggleFaculty = (facName: string) => {
    setSelectedFaculties(prev => 
      prev.includes(facName) ? prev.filter(f => f !== facName) : [...prev, facName]
    );
  };

  const toggleYear = (year: string) => {
    setSelectedYears(prev => 
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );
  };

  const toggleSemester = (sem: string) => {
    setSelectedSemesters(prev => 
      prev.includes(sem) ? prev.filter(s => s !== sem) : [...prev, sem]
    );
  };

  // Filter supervisors strictly by role='supervisor' and tab status
  const filteredSupervisors = useMemo(() => {
    return supervisors.filter(s => {
      if (s.role !== 'supervisor') return false;
      if (s.status !== activeTab) return false;

      // Multi-select Filter by Faculty
      if (selectedFaculties.length > 0 && !selectedFaculties.includes(s.faculty || '')) {
        return false;
      }

      // Multi-select Filter by Teaching Year
      if (selectedYears.length > 0 && !selectedYears.includes(s.teachingYear || '')) {
        return false;
      }

      // Multi-select Filter by Teaching Semester
      if (selectedSemesters.length > 0 && !selectedSemesters.includes(s.teachingSemester || '')) {
        return false;
      }

      // Targeted Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        switch (searchScope) {
          case 'name': {
            const matchesName = (s.fullName || '').toLowerCase().includes(q) || 
                                (s.firstName || '').toLowerCase().includes(q) || 
                                (s.lastName || '').toLowerCase().includes(q);
            if (!matchesName) return false;
            break;
          }
          case 'username': {
            if (!(s.username || '').toLowerCase().includes(q)) return false;
            break;
          }
          case 'email': {
            if (!(s.email || '').toLowerCase().includes(q)) return false;
            break;
          }
          case 'phone': {
            if (!(s.phone || '').toLowerCase().includes(q)) return false;
            break;
          }
          case 'all':
          default: {
            const matchesAll = 
              (s.username || '').toLowerCase().includes(q) ||
              (s.firstName || '').toLowerCase().includes(q) ||
              (s.lastName || '').toLowerCase().includes(q) ||
              (s.fullName || '').toLowerCase().includes(q) ||
              (s.email || '').toLowerCase().includes(q) ||
              (s.phone || '').toLowerCase().includes(q);
            if (!matchesAll) return false;
            break;
          }
        }
      }

      return true;
    });
  }, [supervisors, activeTab, selectedFaculties, selectedYears, selectedSemesters, searchQuery, searchScope]);

  // Sort supervisors
  const sortedSupervisors = useMemo(() => {
    return [...filteredSupervisors].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        const timeA = new Date(aVal).getTime();
        const timeB = new Date(bVal).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      const cmp = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredSupervisors, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    );
  };

  const activeCount = supervisors.filter(s => s.role === 'supervisor' && s.status === 'active').length;
  const suspendedCount = supervisors.filter(s => s.role === 'supervisor' && s.status === 'suspended').length;

  const resetAllFilters = () => {
    setSearchQuery('');
    setSearchScope('all');
    setSelectedFaculties([]);
    setSelectedYears([]);
    setSelectedSemesters([]);
  };

  const hasActiveFilters = searchQuery.trim() !== '' || selectedFaculties.length > 0 || selectedYears.length > 0 || selectedSemesters.length > 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Title & Add Supervisor Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600" />
            Supervisor Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Oversee, filter, activate, and manage teaching supervisor credentials and faculty allocations.
          </p>
        </div>

        <button
          id="add-supervisor-btn"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Supervisor</span>
        </button>
      </div>

      {/* View Tabs: Active Supervisor vs Suspended Supervisor */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          id="tab-active-supervisors"
          onClick={() => setActiveTab('active')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'active'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Active Supervisors</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
            {activeCount}
          </span>
        </button>

        <button
          id="tab-suspended-supervisors"
          onClick={() => setActiveTab('suspended')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'suspended'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>Suspended Supervisors</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
            {suspendedCount}
          </span>
        </button>
      </div>

      {/* Filters and Targeted Search Toolbar */}
      <div ref={dropdownRef} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Targeted Search Bar with Scope Selector */}
          <div className="md:col-span-5 flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition overflow-hidden">
            {/* Scope select dropdown */}
            <select
              id="supervisor-search-scope"
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value as SearchScope)}
              className="bg-slate-100 dark:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 py-2 border-r border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer shrink-0"
              title="Select search field"
            >
              <option value="all">All Fields</option>
              <option value="name">Name</option>
              <option value="username">Username</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>

            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                id="supervisor-search-input"
                type="text"
                placeholder={
                  searchScope === 'all' ? "Search by name, username, email, phone..." :
                  searchScope === 'name' ? "Search by supervisor name..." :
                  searchScope === 'username' ? "Search by username..." :
                  searchScope === 'email' ? "Search by email address..." :
                  "Search by phone number..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Multi-Select Faculty Dropdown */}
          <div className="md:col-span-3 relative">
            <button
              id="supervisor-faculty-filter-btn"
              type="button"
              onClick={() => {
                setIsFacultyDropdownOpen(!isFacultyDropdownOpen);
                setIsYearDropdownOpen(false);
                setIsSemesterDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {selectedFaculties.length === 0
                    ? 'All Faculties'
                    : selectedFaculties.length === 1
                    ? selectedFaculties[0]
                    : `${selectedFaculties.length} Faculties Selected`}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFacultyDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFacultyDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Filter by Faculty
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      onClick={() => setSelectedFaculties(faculties.map(f => f.name))}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setSelectedFaculties([])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                  {faculties.map((fac) => {
                    const isChecked = selectedFaculties.includes(fac.name);
                    return (
                      <label
                        key={fac.id}
                        onClick={() => toggleFaculty(fac.name)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                        />
                        <span className="truncate flex-1 font-medium">{fac.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Multi-Select Year Dropdown */}
          <div className="md:col-span-2 relative">
            <button
              id="supervisor-year-filter-btn"
              type="button"
              onClick={() => {
                setIsYearDropdownOpen(!isYearDropdownOpen);
                setIsFacultyDropdownOpen(false);
                setIsSemesterDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {selectedYears.length === 0
                    ? 'All Years'
                    : selectedYears.length === 1
                    ? selectedYears[0]
                    : `${selectedYears.length} Years`}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isYearDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Academic Year
                  </span>
                  <button
                    onClick={() => setSelectedYears([])}
                    className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {availableYears.map((year) => {
                    const isChecked = selectedYears.includes(year);
                    return (
                      <label
                        key={year}
                        onClick={() => toggleYear(year)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                        />
                        <span className="font-semibold">{year}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Multi-Select Semester Dropdown */}
          <div className="md:col-span-2 relative">
            <button
              id="supervisor-semester-filter-btn"
              type="button"
              onClick={() => {
                setIsSemesterDropdownOpen(!isSemesterDropdownOpen);
                setIsFacultyDropdownOpen(false);
                setIsYearDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-slate-400 font-bold text-xs shrink-0">#</span>
                <span className="truncate">
                  {selectedSemesters.length === 0
                    ? 'All Semesters'
                    : selectedSemesters.length === 1
                    ? selectedSemesters[0]
                    : `${selectedSemesters.length} Semesters`}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSemesterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSemesterDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Semester
                  </span>
                  <button
                    onClick={() => setSelectedSemesters([])}
                    className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {availableSemesters.map((sem) => {
                    const isChecked = selectedSemesters.includes(sem);
                    return (
                      <label
                        key={sem}
                        onClick={() => toggleSemester(sem)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                        />
                        <span className="font-semibold">{sem}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips & Summary */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider mr-1">
                Active Filters:
              </span>

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium">
                  <span>{searchScope.toUpperCase()}: "{searchQuery}"</span>
                  <button onClick={() => setSearchQuery('')} className="hover:text-blue-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedFaculties.map(fac => (
                <span key={fac} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium">
                  <span>{fac}</span>
                  <button onClick={() => toggleFaculty(fac)} className="hover:text-indigo-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {selectedYears.map(year => (
                <span key={year} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium">
                  <span>{year}</span>
                  <button onClick={() => toggleYear(year)} className="hover:text-purple-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {selectedSemesters.map(sem => (
                <span key={sem} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
                  <span>{sem}</span>
                  <button onClick={() => toggleSemester(sem)} className="hover:text-amber-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                Found <strong className="text-slate-900 dark:text-white font-bold">{sortedSupervisors.length}</strong> {sortedSupervisors.length === 1 ? 'supervisor' : 'supervisors'}
              </span>
              <button
                id="reset-all-filters-btn"
                onClick={resetAllFilters}
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Card View - Clean, High Contrast, Compact Layout with Custom Scrollbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table id="supervisor-management-table" className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px] select-none">
              <tr>
                {/* Supervisor Identity Column */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => handleSort('fullName')}>
                  <div className="flex items-center gap-1.5">
                    <span>Supervisor</span>
                    {renderSortIcon('fullName')}
                  </div>
                </th>

                {/* Faculty Column */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => handleSort('faculty')}>
                  <div className="flex items-center gap-1.5">
                    <span>Faculty</span>
                    {renderSortIcon('faculty')}
                  </div>
                </th>

                {/* Academic Term Column */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => handleSort('teachingYear')}>
                  <div className="flex items-center gap-1.5">
                    <span>Academic Term</span>
                    {renderSortIcon('teachingYear')}
                  </div>
                </th>

                {/* Contact Column */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => handleSort('email')}>
                  <div className="flex items-center gap-1.5">
                    <span>Contact Info</span>
                    {renderSortIcon('email')}
                  </div>
                </th>

                {/* Created / Updated Date Column */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center gap-1.5">
                    <span>Created Date</span>
                    {renderSortIcon('createdAt')}
                  </div>
                </th>

                {/* Actions Column */}
                <th className="py-3.5 px-4 text-right font-bold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedSupervisors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs italic">
                    No supervisors match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                sortedSupervisors.map((s) => {
                  const initial = getInitials(s.firstName || s.fullName || 'S');
                  return (
                    <tr 
                      key={s.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition group"
                    >
                      {/* Supervisor Name + Username Avatar Cell */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl ${s.avatarColor || 'bg-blue-600'} text-white flex items-center justify-center font-bold text-xs shrink-0 uppercase shadow-2xs`}>
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white leading-tight">
                              {s.fullName || `${s.firstName} ${s.lastName}`}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              @{s.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Faculty Badge */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.faculty || 'Unassigned'}
                        </div>
                      </td>

                      {/* Academic Term */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                          <span className="font-bold text-blue-600 dark:text-blue-400">{s.teachingYear || '2026'}</span>
                          <span className="text-slate-400">&bull;</span>
                          <span>{s.teachingSemester || 'Semester 1'}</span>
                        </div>
                      </td>

                      {/* Contact Info (Email & Phone) */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{s.email}</span>
                          </div>
                          {s.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{s.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
                        <div>{formatDate(s.createdAt)}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          Updated: {formatDate(s.updatedAt)}
                        </div>
                      </td>

                      {/* Actions Column: Edit, Password, Suspend/Activate */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Supervisor Information Action for Admin */}
                          <button
                            id={`edit-supervisor-btn-${s.id}`}
                            onClick={() => setEditTarget(s)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            title="Edit supervisor information"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Edit</span>
                          </button>

                          {/* Change Password Action for Admin */}
                          <button
                            id={`change-password-btn-${s.id}`}
                            onClick={() => setPasswordChangeTarget(s)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            title="Change password for this supervisor"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                            <span>Password</span>
                          </button>

                          {activeTab === 'active' ? (
                            /* Active Supervisor Action: Suspend */
                            <button
                              id={`suspend-btn-${s.id}`}
                              onClick={() => setConfirmSuspendUser(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Suspend</span>
                            </button>
                          ) : (
                            /* Suspended Supervisor Action: Activate */
                            <button
                              id={`activate-btn-${s.id}`}
                              onClick={() => setConfirmActivateUser(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Activate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Supervisor Modal */}
      {isAddModalOpen && (
        <AddSupervisorModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Edit Supervisor Modal */}
      {editTarget && (
        <EditSupervisorModal
          supervisor={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Change Password Modal */}
      {passwordChangeTarget && (
        <ChangePasswordModal
          supervisor={passwordChangeTarget}
          onClose={() => setPasswordChangeTarget(null)}
        />
      )}

      {/* Confirmation Modal: Suspend Supervisor */}
      {confirmSuspendUser && (
        <div 
          id="confirm-suspend-modal-backdrop"
          onClick={() => setConfirmSuspendUser(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div 
            id="confirm-suspend-modal"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Suspend Supervisor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to suspend <span className="font-semibold text-slate-800 dark:text-slate-200">"{confirmSuspendUser.fullName}"</span> (@{confirmSuspendUser.username})? They will be unable to log in until reactivated.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                id="cancel-suspend-btn"
                onClick={() => setConfirmSuspendUser(null)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-suspend-action-btn"
                onClick={() => {
                  suspendSupervisor(confirmSuspendUser.id);
                  setConfirmSuspendUser(null);
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Activate Supervisor */}
      {confirmActivateUser && (
        <div 
          id="confirm-activate-modal-backdrop"
          onClick={() => setConfirmActivateUser(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div 
            id="confirm-activate-modal"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
              <UserCheck className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Reactivate Supervisor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restore login access for <span className="font-semibold text-slate-800 dark:text-slate-200">"{confirmActivateUser.fullName}"</span> (@{confirmActivateUser.username})?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                id="cancel-activate-btn"
                onClick={() => setConfirmActivateUser(null)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-activate-action-btn"
                onClick={() => {
                  activateSupervisor(confirmActivateUser.id);
                  setConfirmActivateUser(null);
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
