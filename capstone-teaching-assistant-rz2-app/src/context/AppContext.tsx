import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  User,
  Faculty,
  Semester,
  Conversation,
  AttachedFile,
  Message,
  ThemeMode,
  AdminActiveView,
  SupervisorActiveView
} from '../types';
import { ApiClient, ApiClientError, mapAccount } from '../api/client';

interface AppContextType {
  api: ApiClient;
  semesters: Semester[];
  refreshAdminData: () => Promise<void>;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  currentUser: User | null;
  login: (username: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateCurrentUser: (userData: Partial<User>) => void;
  changeCurrentUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  requestPasswordReset: (identifier: string) => Promise<{ success: boolean; message: string }>;
  activeAdminView: AdminActiveView;
  setActiveAdminView: (view: AdminActiveView) => void;
  supervisors: User[];
  faculties: Faculty[];
  addSupervisor: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'fullName' | 'role' | 'status' | 'password'>) => Promise<{ success: boolean; message?: string }>;
  updateSupervisor: (id: string, data: Partial<User>) => Promise<{ success: boolean; message?: string }>;
  suspendSupervisor: (id: string) => Promise<void>;
  activateSupervisor: (id: string) => Promise<void>;
  resetSupervisorPassword: (id: string) => Promise<{ success: boolean; message: string }>;
  deleteSupervisor: (id: string) => Promise<void>;
  addFaculty: (faculty: Omit<Faculty, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; message?: string }>;
  updateFaculty: (id: string, faculty: Partial<Faculty>) => Promise<{ success: boolean; message?: string }>;
  deleteFaculty: (id: string) => Promise<boolean>;
  activeSupervisorView: SupervisorActiveView;
  setActiveSupervisorView: (view: SupervisorActiveView) => void;
  conversations: Conversation[];
  searchConversations: (query: string) => Promise<Conversation[]>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  activeConversation: Conversation | null;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  createConversation: () => Promise<Conversation | null>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<boolean>;
  isGeneratingResponse: boolean;
  downloadFile: (file: AttachedFile) => Promise<void>;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  onSelectLibraryFilesForChat?: (files: AttachedFile[]) => void;
  fileToPreview: AttachedFile | null;
  setFileToPreview: (file: AttachedFile | null) => void;
  previewFile: (file: AttachedFile) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  THEME: 'cta_theme_mode',
  TOKEN: 'cta_access_token',
  AUTH_USER: 'cta_auth_user',
};

const avatarColors = ['bg-blue-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-purple-600', 'bg-teal-600', 'bg-amber-600'];

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('Could not read file preview.'));
  reader.onerror = () => reject(reader.error || new Error('Could not read file preview.'));
  reader.readAsDataURL(blob);
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.TOKEN));
  const api = useMemo(() => new ApiClient({
    getToken: () => localStorage.getItem(STORAGE_KEYS.TOKEN),
    setToken: (nextToken) => {
      setToken(nextToken);
      if (nextToken) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, nextToken);
      } else {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
      }
    },
  }), []);

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode) || 'system';
  });
  const [isDark, setIsDark] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const scope = useRef<string | null>(null);
  const epoch = useRef(0);
  const refreshSequence = useRef(0);
  const streamController = useRef<AbortController | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeAdminView, setActiveAdminView] = useState<AdminActiveView>('supervisors');
  const [activeSupervisorView, setActiveSupervisorView] = useState<SupervisorActiveView>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [fileToPreview, setFileToPreview] = useState<AttachedFile | null>(null);

  useEffect(() => {
    const updateTheme = () => {
      const dark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    };
    updateTheme();
    localStorage.setItem(STORAGE_KEYS.THEME, themeMode);
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => updateTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  }, [currentUser]);

  const setThemeMode = (mode: ThemeMode) => setThemeModeState(mode);

  const showError = useCallback((error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    alert(message || fallback);
  }, []);

  const refreshAdminData = useCallback(async () => {
    const [nextFaculties, active, inactive, nextSemesters] = await Promise.all([
      api.listAdminFaculties(),
      api.listSupervisors({ status: 'ACTIVE' }),
      api.listSupervisors({ status: 'INACTIVE' }),
      api.activeSemesters(),
    ]);
    setFaculties(nextFaculties);
    setSemesters(nextSemesters);
    setSupervisors([...active, ...inactive].map((user, index) => ({
      ...user,
      avatarColor: avatarColors[index % avatarColors.length],
    })));
  }, [api]);

  const refreshSupervisorData = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const startedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const user = mapAccount(await api.getAccount());
    if (sequence !== refreshSequence.current || startedToken !== localStorage.getItem(STORAGE_KEYS.TOKEN)) return null;
    const nextScope = `${user.id}:${user.semester?.id}:${user.semester?.deleted_at || ''}`;
    if (scope.current !== nextScope) {
      epoch.current++;
      scope.current = nextScope;
      streamController.current?.abort();
      setIsGeneratingResponse(false);
      setConversations([]);
      setActiveConversationId(null);
      setIsSearchModalOpen(false);
      setFileToPreview(null);
    }
    setCurrentUser(user);
    const version = epoch.current;
    const nextConversations = await api.listConversations();
    if (version !== epoch.current || sequence !== refreshSequence.current) return null;
    setConversations(prev => nextConversations.map(conversation => ({ ...conversation, messages: prev.find(c => c.id === conversation.id)?.messages || [] })));
    setActiveConversationId(prev => prev && nextConversations.some(c => c.id === prev) ? prev : null);
    return user;
  }, [api]);

  const ensureWritable = async () => {
    const oldScope = scope.current;
    const user = await refreshSupervisorData();
    if (!user || oldScope !== scope.current) throw new Error('Your semester assignment changed. Please select a conversation or start a new one.');
    if (!user.semester || user.semester.deleted_at) throw new Error('This semester is archived and read-only.');
  };

  useEffect(() => {
    if (!token || currentUser?.role !== 'supervisor') return;
    const refresh = () => { refreshSupervisorData().catch(error => showError(error, 'Could not refresh semester.')); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [token, currentUser?.role, refreshSupervisorData, showError]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      const version = epoch.current;
      const messages = await api.listConversationMessages(conversationId);
      if (version !== epoch.current) return;
      setConversations(prev => prev.map(conversation => conversation.id === conversationId ? { ...conversation, messages } : conversation));
    } catch (error) {
      showError(error, 'Could not load conversation messages.');
      if (error instanceof ApiClientError && [404, 409].includes(error.status)) await refreshSupervisorData();
    }
  }, [api, showError, refreshSupervisorData]);

  const searchConversations = useCallback(async (query: string): Promise<Conversation[]> => {
    if (!query.trim()) return conversations;
    try {
      const version = epoch.current;
      const results = await api.searchConversations(query.trim());
      if (version !== epoch.current) return [];
      return results.map(result => ({
        ...result,
        messages: conversations.find(conversation => conversation.id === result.id)?.messages || [],
      }));
    } catch (error) {
      showError(error, 'Could not search conversations.');
      if (error instanceof ApiClientError && [404, 409].includes(error.status)) await refreshSupervisorData();
      return [];
    }
  }, [api, conversations, showError, refreshSupervisorData]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const account = await api.getAccount();
        if (cancelled) return;
        const user = mapAccount(account);
        setCurrentUser(user);
        if (user.role === 'admin') {
          await refreshAdminData();
        } else {
          const nextFaculties = await api.listFaculties();
          if (!cancelled) setFaculties(nextFaculties);
          await refreshSupervisorData();
        }
      } catch {
        api.logout();
        setCurrentUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, api, refreshAdminData, refreshSupervisorData]);

  useEffect(() => {
    if (activeConversationId) {
      loadConversationMessages(activeConversationId);
    }
  }, [activeConversationId, loadConversationMessages]);

  const login = async (username: string, password = ''): Promise<{ success: boolean; message?: string }> => {
    try {
      await api.login(username.trim(), password);
      const account = await api.getAccount();
      const user = mapAccount(account);
      setCurrentUser(user);
      if (user.status === 'suspended') {
        await api.logout();
        setCurrentUser(null);
        return { success: false, message: 'This account is currently inactive. Please contact the administrator.' };
      }
      if (user.role === 'admin') {
        setActiveAdminView('supervisors');
        await refreshAdminData();
      } else {
        setActiveSupervisorView('chat');
        const nextFaculties = await api.listFaculties();
        setFaculties(nextFaculties);
        await refreshSupervisorData();
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Invalid username or password.',
      };
    }
  };

  const logout = async () => {
    epoch.current++;
    refreshSequence.current++;
    scope.current = null;
    streamController.current?.abort();
    setFileToPreview(null);
    setIsSearchModalOpen(false);
    await api.logout();
    setCurrentUser(null);
    setSupervisors([]);
    setConversations([]);
    setActiveConversationId(null);
    setIsProfileModalOpen(false);
  };

  const updateCurrentUser = () => {
    alert('Profile updates are administered centrally and are not supported by the current API.');
  };

  const changeCurrentUserPassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      // The server revokes the current token; the caller signs out after showing the message.
      const response = await api.changePassword(currentPassword, newPassword);
      return { success: true, message: `${response.message} Please sign in again.` };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Password update failed.' };
    }
  };

  const requestPasswordReset = async (identifier: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.forgotPassword(identifier.trim());
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Could not request a password reset.' };
    }
  };

  const addSupervisor = async (data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'fullName' | 'role' | 'status' | 'password'>) => {
    try {
      await api.createSupervisor(data, faculties);
      await refreshAdminData();
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Could not create supervisor.' };
    }
  };

  const updateSupervisor = async (id: string, data: Partial<User>) => {
    try {
      const current = supervisors.find(supervisor => supervisor.id === id);
      if (current && data.username !== undefined && data.username !== current.username) {
        throw new ApiClientError(422, 'UNSUPPORTED_SUPERVISOR_USERNAME', 'Supervisor username cannot be changed.');
      }
      await api.updateSupervisor(id, data, faculties);
      await refreshAdminData();
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Could not update supervisor.' };
    }
  };

  const suspendSupervisor = async (id: string) => {
    try {
      await api.updateSupervisorStatus(id, 'INACTIVE');
      await refreshAdminData();
    } catch (error) {
      showError(error, 'Could not deactivate supervisor.');
    }
  };

  const activateSupervisor = async (id: string) => {
    try {
      await api.updateSupervisorStatus(id, 'ACTIVE');
      await refreshAdminData();
    } catch (error) {
      showError(error, 'Could not activate supervisor.');
    }
  };

  const resetSupervisorPassword = async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.resetSupervisorPassword(id);
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Could not reset supervisor password.' };
    }
  };

  const deleteSupervisor = async (id: string) => {
    try {
      await api.deleteSupervisor(id);
      await refreshAdminData();
    } catch (error) {
      showError(error, 'Could not delete supervisor.');
    }
  };

  const addFaculty = async (faculty: Omit<Faculty, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await api.createFaculty({ name: faculty.name, code: faculty.code });
      await refreshAdminData();
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Could not create faculty.' };
    }
  };

  const updateFaculty = async (id: string, faculty: Partial<Faculty>) => {
    try {
      await api.updateFaculty(id, faculty);
      await refreshAdminData();
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Could not update faculty.' };
    }
  };

  const deleteFaculty = async (id: string): Promise<boolean> => {
    try {
      await api.deleteFaculty(id);
      await refreshAdminData();
      return true;
    } catch (error) {
      showError(error, 'Could not delete faculty.');
      return false;
    }
  };

  const createConversation = async (): Promise<Conversation | null> => {
    try {
      await ensureWritable();
      const version = epoch.current;
      const conversation = await api.createConversation();
      if (version !== epoch.current) return null;
      setConversations(prev => [conversation, ...prev]);
      setActiveConversationId(conversation.id);
      return conversation;
    } catch (error) {
      showError(error, 'Could not create conversation.');
      await refreshSupervisorData();
      return null;
    }
  };

  const renameConversation = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      await ensureWritable();
      await api.renameConversation(id, newTitle.trim());
      setConversations(prev => prev.map(conversation => conversation.id === id ? { ...conversation, title: newTitle.trim(), updatedAt: new Date().toISOString() } : conversation));
    } catch (error) {
      showError(error, 'Could not rename conversation.');
      if (error instanceof ApiClientError && [404, 409].includes(error.status)) await refreshSupervisorData();
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await ensureWritable();
      await api.deleteConversation(id);
      setConversations(prev => {
        const remaining = prev.filter(conversation => conversation.id !== id);
        if (activeConversationId === id) {
          setActiveConversationId(remaining[0]?.id || null);
        }
        return remaining;
      });
    } catch (error) {
      showError(error, 'Could not delete conversation.');
      if (error instanceof ApiClientError && [404, 409].includes(error.status)) await refreshSupervisorData();
    }
  };

  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) || null;

  const sendMessage = async (content: string) => {
    const messageContent = content.trim();
    if (!messageContent || isGeneratingResponse) return false;
    let target = activeConversation;
    let created = false;
    let version = epoch.current;
    try {
      await ensureWritable();
      if (!target) target = await createConversation();
      if (!target) return false;
      version = epoch.current;
      setIsGeneratingResponse(true);
      const controller = new AbortController();
      streamController.current = controller;
      const response = await api.createMessage(target.id, messageContent);
      if (version !== epoch.current) return false;
      created = true;
      const now = new Date().toISOString();
      const userMessage: Message = { id: response.user_message.id, role: 'user', content: response.user_message.content, timestamp: now };
      const assistantMessage: Message = { id: response.assistant_message.id, role: 'assistant', content: '', timestamp: now };
      setConversations(prev => prev.map(c => c.id === target!.id ? { ...c, title: response.conversation_title, updatedAt: now, messages: [...c.messages, userMessage, assistantMessage] } : c));
      await api.streamMessage(response.stream_url, delta => {
        if (version !== epoch.current) return;
        setConversations(prev => prev.map(c => c.id === target!.id ? { ...c, messages: c.messages.map(m => m.id === assistantMessage.id ? { ...m, content: m.content + delta } : m) } : c));
      }, controller.signal);
      if (version === epoch.current) await loadConversationMessages(target.id);
    } catch (error) {
      if (version === epoch.current) {
        showError(error, 'Could not send message.');
        await refreshSupervisorData();
        if (target && version === epoch.current) await loadConversationMessages(target.id);
      }
    } finally {
      if (version === epoch.current) setIsGeneratingResponse(false);
    }
    return created;
  };

  const downloadFile = async (file: AttachedFile) => {
    try {
      const blob = await api.downloadFile(file.id);
      const element = document.createElement('a');
      const url = URL.createObjectURL(blob);
      element.href = url;
      element.download = file.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error, 'Could not download file.');
    }
  };

  const previewFile = useCallback((file: AttachedFile) => {
    const isImage = file.isImage || file.type.startsWith('image/');
    const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    const isText = file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.md');
    setFileToPreview({ ...file, isPreviewLoading: true, previewError: undefined });

    const preview = isImage || isPdf
      ? api.downloadFile(file.id).then(blobToDataUrl)
      : isText
        ? api.getFileContent(file.id).then(response => {
            const encoded = btoa(unescape(encodeURIComponent(response.content)));
            return `data:${response.mime_type};base64,${encoded}`;
          })
        : Promise.reject(new Error('Preview is unavailable for this file format.'));

    preview
      .then(dataUrl => setFileToPreview(current => current?.id === file.id ? {
        ...current,
        dataUrl,
        isPreviewLoading: false,
      } : current))
      .catch(error => setFileToPreview(current => current?.id === file.id ? {
        ...current,
        isPreviewLoading: false,
        previewError: error instanceof Error ? error.message : 'File preview is unavailable.',
      } : current));
  }, [api]);

  return (
    <AppContext.Provider
      value={{
        api,
        semesters,
        refreshAdminData,
        themeMode,
        setThemeMode,
        isDark,
        currentUser,
        login,
        logout,
        updateCurrentUser,
        changeCurrentUserPassword,
        requestPasswordReset,
        activeAdminView,
        setActiveAdminView,
        supervisors,
        faculties,
        addSupervisor,
        updateSupervisor,
        suspendSupervisor,
        activateSupervisor,
        resetSupervisorPassword,
        deleteSupervisor,
        addFaculty,
        updateFaculty,
        deleteFaculty,
        activeSupervisorView,
        setActiveSupervisorView,
        conversations,
        searchConversations,
        activeConversationId,
        setActiveConversationId,
        activeConversation,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        createConversation,
        renameConversation,
        deleteConversation,
        sendMessage,
        isGeneratingResponse,
        downloadFile,
        isSearchModalOpen,
        setIsSearchModalOpen,
        isProfileModalOpen,
        setIsProfileModalOpen,
        fileToPreview,
        setFileToPreview,
        previewFile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
