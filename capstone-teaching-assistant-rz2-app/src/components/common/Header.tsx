import React, { useState, useRef, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Monitor, 
  User as UserIcon, 
  LogOut, 
  ChevronDown, 
  Check,
  Menu
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getInitials } from '../../utils/formatters';
import { AppLogo } from './AppLogo';

interface HeaderProps {
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileSidebar }) => {
  const { 
    currentUser, 
    logout, 
    themeMode, 
    setThemeMode, 
    setIsProfileModalOpen,
  } = useApp();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) return null;

  const initialChar = getInitials(currentUser.firstName || currentUser.fullName || 'U');
  const isAdmin = currentUser.role === 'admin';

  return (
    <header 
      id="app-header" 
      className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30 transition-colors"
    >
      {/* Left side: Hamburger on mobile / CTA Brand Title */}
      <div className="flex items-center gap-3">
        {onToggleMobileSidebar && (
          <button
            id="mobile-sidebar-toggle-btn"
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <AppLogo size="sm" showSparkle={true} />
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base hidden sm:inline-block tracking-tight">
            Capstone Teaching Assistant
          </span>
        </div>
      </div>

      {/* Right side: Theme Switcher + User Account Logo Dropdown */}
      <div className="flex items-center gap-2">
        {/* Theme mode switcher dropdown */}
        <div className="relative" ref={themeMenuRef}>
          <button
            id="theme-selector-btn"
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title={`Current theme: ${themeMode}`}
            aria-label="Select theme"
          >
            {themeMode === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
            {themeMode === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
            {themeMode === 'system' && <Monitor className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {isThemeMenuOpen && (
            <div 
              id="theme-menu-dropdown"
              className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Theme
              </div>
              <button
                id="theme-option-system"
                onClick={() => { setThemeMode('system'); setIsThemeMenuOpen(false); }}
                className={`w-full px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer ${
                  themeMode === 'system' ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/30' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5" />
                  System
                </span>
                {themeMode === 'system' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
              <button
                id="theme-option-light"
                onClick={() => { setThemeMode('light'); setIsThemeMenuOpen(false); }}
                className={`w-full px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer ${
                  themeMode === 'light' ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/30' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  Light
                </span>
                {themeMode === 'light' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
              <button
                id="theme-option-dark"
                onClick={() => { setThemeMode('dark'); setIsThemeMenuOpen(false); }}
                className={`w-full px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer ${
                  themeMode === 'dark' ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/30' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  Dark
                </span>
                {themeMode === 'dark' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
            </div>
          )}
        </div>

        {/* Account Logo button */}
        <div className="relative" ref={userMenuRef}>
          <button
            id="account-logo-btn"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            aria-label="Account Menu"
          >
            {/* Account logo generated by first character of Firstname */}
            <div 
              id="account-avatar-circle"
              className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm uppercase"
            >
              {initialChar}
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate hidden md:inline">
              {currentUser.firstName} {currentUser.lastName}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div 
              id="account-menu-dropdown"
              className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100"
            >
              {/* User Profile Header */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {/* Account logo circle */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm uppercase shrink-0">
                    {initialChar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {currentUser.firstName} {currentUser.lastName}
                    </div>
                    {isAdmin ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        @{currentUser.username || 'admin'}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {currentUser.faculty || 'Computer Science'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu Actions */}
              {!isAdmin && (
                <div className="py-1">
                  <button
                    id="account-menu-profile-btn"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Profile & Security</span>
                  </button>
                </div>
              )}

              {/* Logout button */}
              <div className="py-1">
                <button
                  id="account-menu-logout-btn"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full px-4 py-2 text-xs flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition font-medium cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
