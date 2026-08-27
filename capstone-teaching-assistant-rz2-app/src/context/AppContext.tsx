import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  Faculty,
  Project,
  Conversation,
  AttachedFile,
  Message,
  ThemeMode,
  AdminActiveView,
  SupervisorActiveView
} from '../types';
import { ApiClient, ApiClientError, mapAccount } from '../api/client';

interface AppContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  currentUser: User | null;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateCurrentUser: (userData: Partial<User>) => void;
  changeCurrentUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  activeAdminView: AdminActiveView;
  setActiveAdminView: (view: AdminActiveView) => void;
  supervisors: User[];
  faculties: Faculty[];
  addSupervisor: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'fullName' | 'role' | 'status'>) => Promise<void>;
  updateSupervisor: (id: string, data: Partial<User>) => Promise<void>;
  suspendSupervisor: (id: string) => Promise<void>;
  activateSupervisor: (id: string) => Promise<void>;
  changeSupervisorPassword: (id: string, newPassword: string) => Promise<boolean>;
  deleteSupervisor: (id: string) => Promise<void>;
  addFaculty: (faculty: Omit<Faculty, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateFaculty: (id: string, faculty: Partial<Faculty>) => Promise<void>;
  deleteFaculty: (id: string) => Promise<boolean>;
  activeSupervisorView: SupervisorActiveView;
  setActiveSupervisorView: (view: SupervisorActiveView) => void;
  projects: Project[];
  conversations: Conversation[];
  searchConversations: (query: string) => Promise<Conversation[]>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  activeConversation: Conversation | null;
  libraryFiles: AttachedFile[];
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  expandedProjectIds: string[];
  toggleProjectExpanded: (projectId: string) => void;
  createProject: (name: string, instructions?: string) => Promise<Project | null>;
  updateProject: (id: string, name: string, instructions?: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createConversation: (projectId?: string | null, customTitle?: string) => Promise<Conversation | null>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  moveConversationToProject: (conversationId: string, projectId: string | null) => Promise<void>;
  sendMessage: (content: string, attachedFiles?: AttachedFile[]) => Promise<void>;
  isGeneratingResponse: boolean;
  uploadFiles: (files: FileList | File[], projectId?: string | null) => Promise<AttachedFile[]>;
  deleteFile: (fileId: string) => Promise<void>;
  deleteFilesBulk: (fileIds: string[]) => Promise<void>;
  assignFileToProject: (fileId: string, projectId: string | null) => Promise<void>;
  removeFileFromProject: (projectId: string, fileId: string) => Promise<void>;
  downloadFile: (file: AttachedFile) => Promise<void>;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  isCreateProjectModalOpen: boolean;
  setIsCreateProjectModalOpen: (open: boolean) => void;
  pendingMoveConversationId: string | null;
  setPendingMoveConversationId: (id: string | null) => void;
  projectToEdit: Project | null;
  setProjectToEdit: (proj: Project | null) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  isAddFromLibraryOpen: boolean;
  setIsAddFromLibraryOpen: (open: boolean) => void;
  onSelectLibraryFilesForChat?: (files: AttachedFile[]) => void;
  setOnSelectLibraryFilesForChat: (callback: ((files: AttachedFile[]) => void) | undefined) => void;
  pendingChatAttachments: AttachedFile[];
  setPendingChatAttachments: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  startConversationWithFiles: (files: AttachedFile[], projectId?: string | null) => Promise<void>;
  fileToPreview: AttachedFile | null;
  setFileToPreview: (file: AttachedFile | null) => void;
  previewFile: (file: AttachedFile) => void;
  quickLoginAs: (role: 'admin' | 'supervisor') => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  THEME: 'cta_theme_mode',
  TOKEN: 'cta_access_token',
  AUTH_USER: 'cta_auth_user',
};

const DEMO_CREDENTIALS = {
  admin: {
    username: import.meta.env.VITE_DEMO_ADMIN_USERNAME || 'admin',
    password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'AdminPassword123!',
  },
  supervisor: {
    username: import.meta.env.VITE_DEMO_SUPERVISOR_USERNAME || 'supervisor',
    password: import.meta.env.VITE_DEMO_SUPERVISOR_PASSWORD || 'super123',
  },
};

const avatarColors = ['bg-blue-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-purple-600', 'bg-teal-600', 'bg-amber-600'];

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [libraryFiles, setLibraryFiles] = useState<AttachedFile[]>([]);
  const [activeAdminView, setActiveAdminView] = useState<AdminActiveView>('supervisors');
  const [activeSupervisorView, setActiveSupervisorView] = useState<SupervisorActiveView>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState<boolean>(false);
  const [pendingMoveConversationId, setPendingMoveConversationId] = useState<string | null>(null);
  const [projectToEdit, setProjectToEditState] = useState<Project | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isAddFromLibraryOpen, setIsAddFromLibraryOpen] = useState<boolean>(false);
  const [onSelectLibraryFilesForChat, setOnSelectLibraryFilesForChat] = useState<((files: AttachedFile[]) => void) | undefined>(undefined);
  const [pendingChatAttachments, setPendingChatAttachments] = useState<AttachedFile[]>([]);
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
    const [nextFaculties, active, inactive] = await Promise.all([
      api.listAdminFaculties(),
      api.listSupervisors({ status: 'ACTIVE' }),
      api.listSupervisors({ status: 'INACTIVE' }),
    ]);
    setFaculties(nextFaculties);
    setSupervisors([...active, ...inactive].map((user, index) => ({
      ...user,
      avatarColor: avatarColors[index % avatarColors.length],
    })));
  }, [api]);

  const refreshSupervisorData = useCallback(async () => {
    const [nextProjects, nextConversations, nextFiles] = await Promise.all([
      api.listProjects(),
      api.listConversations(),
      api.listFiles(),
    ]);
    const projectFiles = await Promise.all(nextProjects.map(project => api.listProjectFiles(project.id).catch(() => [])));
    const projectIdByFile = new Map<string, string>();
    projectFiles.forEach((files, index) => {
      files.forEach(file => projectIdByFile.set(file.id, nextProjects[index].id));
    });

    setProjects(nextProjects);
    setExpandedProjectIds(prev => prev.length ? prev.filter(id => nextProjects.some(project => project.id === id)) : nextProjects.map(project => project.id));
    setLibraryFiles(nextFiles.map(file => ({ ...file, projectId: projectIdByFile.get(file.id) || null })));
    setConversations(prev => {
      const messageMap = new Map(prev.map(conversation => [conversation.id, conversation.messages]));
      return nextConversations.map(conversation => ({
        ...conversation,
        messages: messageMap.get(conversation.id) || [],
      }));
    });
    setActiveConversationId(prev => prev && nextConversations.some(conversation => conversation.id === prev) ? prev : nextConversations[0]?.id || null);
  }, [api]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      const messages = await api.listConversationMessages(conversationId);
      setConversations(prev => prev.map(conversation => conversation.id === conversationId ? { ...conversation, messages } : conversation));
    } catch (error) {
      showError(error, 'Could not load conversation messages.');
    }
  }, [api, showError]);

  const searchConversations = useCallback(async (query: string): Promise<Conversation[]> => {
    if (!query.trim()) return conversations;
    try {
      const results = await api.searchConversations(query.trim());
      return results.map(result => ({
        ...result,
        messages: conversations.find(conversation => conversation.id === result.id)?.messages || [],
      }));
    } catch (error) {
      showError(error, 'Could not search conversations.');
      return [];
    }
  }, [api, conversations, showError]);

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

  const login = async (username: string, password = ''): Promise<boolean> => {
    try {
      await api.login(username.trim(), password);
      const account = await api.getAccount();
      const user = mapAccount(account);
      setCurrentUser(user);
      if (user.status === 'suspended') {
        await api.logout();
        setCurrentUser(null);
        alert('This account is currently inactive. Please contact the administrator.');
        return false;
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
      return true;
    } catch (error) {
      showError(error, 'Invalid username or password.');
      return false;
    }
  };

  const logout = async () => {
    await api.logout();
    setCurrentUser(null);
    setSupervisors([]);
    setProjects([]);
    setConversations([]);
    setLibraryFiles([]);
    setActiveConversationId(null);
  };

  const updateCurrentUser = () => {
    alert('Profile updates are administered centrally and are not supported by the current API.');
  };

  const changeCurrentUserPassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.changePassword(currentPassword, newPassword);
      await logout();
      return { success: true, message: `${response.message} Please sign in again.` };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Password update failed.' };
    }
  };

  const quickLoginAs = async (role: 'admin' | 'supervisor') => {
    const credentials = DEMO_CREDENTIALS[role];
    await login(credentials.username, credentials.password);
  };

  const addSupervisor = async (data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'fullName' | 'role' | 'status'>) => {
    try {
      await api.createSupervisor(data, faculties);
      await refreshAdminData();
    } catch (error) {
      showError(error, 'Could not create supervisor.');
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
    } catch (error) {
      showError(error, 'Could not update supervisor.');
    }
  };

  const suspendSupervisor = async (id: string) => {
    try {
      await api.updateSupervisorStatus(id, 'INACTIVE');
      await refreshAdminData();
    } catch (error) {
      showError(error, 'Could not suspend supervisor.');
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

  const changeSupervisorPassword = async (id: string, newPassword: string): Promise<boolean> => {
    try {
      await api.resetSupervisorPassword(id, newPassword);
      return true;
    } catch (error) {
      showError(error, 'Could not reset supervisor password.');
      return false;
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
    } catch (error) {
      showError(error, 'Could not create faculty.');
    }
  };

  const updateFaculty = async (id: string, faculty: Partial<Faculty>) => {
    try {
      await api.updateFaculty(id, faculty);
      await refreshAdminData();
    } catch (error) {
      showError(error, 'Could not update faculty.');
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

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds(prev => prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]);
  };

  const createProject = async (name: string, instructions?: string): Promise<Project | null> => {
    try {
      const project = await api.createProject(name.trim(), instructions);
      setProjects(prev => [project, ...prev]);
      setExpandedProjectIds(prev => [...prev, project.id]);
      if (pendingMoveConversationId) {
        await moveConversationToProject(pendingMoveConversationId, project.id);
        setPendingMoveConversationId(null);
      }
      return project;
    } catch (error) {
      showError(error, 'Could not create project.');
      return null;
    }
  };

  const updateProject = async (id: string, name: string, instructions?: string) => {
    try {
      await api.updateProject(id, name.trim(), instructions);
      await refreshSupervisorData();
    } catch (error) {
      showError(error, 'Could not update project.');
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      await refreshSupervisorData();
    } catch (error) {
      showError(error, 'Could not delete project.');
    }
  };

  const createConversation = async (projectId: string | null = null, customTitle?: string): Promise<Conversation | null> => {
    try {
      const conversation = await api.createConversation(projectId);
      let nextConversation = conversation;
      if (customTitle) {
        await api.renameConversation(conversation.id, customTitle);
        nextConversation = { ...conversation, title: customTitle };
      }
      setConversations(prev => [nextConversation, ...prev]);
      setActiveConversationId(nextConversation.id);
      setActiveSupervisorView('chat');
      return nextConversation;
    } catch (error) {
      showError(error, 'Could not create conversation.');
      return null;
    }
  };

  const startConversationWithFiles = async (files: AttachedFile[], projectId?: string | null) => {
    if (!files.length) return;
    let targetProjectId = projectId;
    if (targetProjectId === undefined) {
      const distinctProjectIds = Array.from(new Set(files.map(file => file.projectId).filter(Boolean)));
      targetProjectId = distinctProjectIds.length === 1 ? distinctProjectIds[0] as string : null;
    }
    const titleNames = files.map(file => file.name).join(', ');
    const title = `Analysis: ${titleNames.length > 30 ? `${titleNames.slice(0, 30)}...` : titleNames}`;
    const conversation = await createConversation(targetProjectId || null, title);
    if (!conversation) return;
    try {
      await api.associateConversationFiles(conversation.id, files.map(file => file.id));
      setPendingChatAttachments(files);
    } catch (error) {
      showError(error, 'Could not attach files to the conversation.');
    }
  };

  const renameConversation = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      await api.renameConversation(id, newTitle.trim());
      setConversations(prev => prev.map(conversation => conversation.id === id ? { ...conversation, title: newTitle.trim(), updatedAt: new Date().toISOString() } : conversation));
    } catch (error) {
      showError(error, 'Could not rename conversation.');
    }
  };

  const deleteConversation = async (id: string) => {
    try {
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
    }
  };

  const moveConversationToProject = async (conversationId: string, projectId: string | null) => {
    try {
      await api.moveConversation(conversationId, projectId);
      setConversations(prev => prev.map(conversation => conversation.id === conversationId ? { ...conversation, projectId, updatedAt: new Date().toISOString() } : conversation));
      if (projectId) {
        setExpandedProjectIds(prev => prev.includes(projectId) ? prev : [...prev, projectId]);
      }
      await refreshSupervisorData();
    } catch (error) {
      showError(error, 'Could not move conversation.');
    }
  };

  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) || null;

  const sendMessage = async (content: string, attachedFiles: AttachedFile[] = []) => {
    const messageFiles = attachedFiles.length ? attachedFiles : pendingChatAttachments;
    const messageContent = content.trim();
    if (!messageContent && !messageFiles.length) {
      alert('Please enter a message or attach files.');
      return;
    }
    let targetConversation = activeConversation;
    if (!targetConversation) {
      const titleSeed = messageContent || messageFiles.map(file => file.name).join(', ');
      targetConversation = await createConversation(null, titleSeed.slice(0, 36) + (titleSeed.length > 36 ? '...' : ''));
      if (!targetConversation) return;
    }

    setIsGeneratingResponse(true);
    try {
      const response = await api.createMessage(targetConversation.id, messageContent, messageFiles.map(file => file.id));
      const now = new Date().toISOString();
      const userMessage: Message = {
        id: response.user_message.id,
        role: 'user',
        content: response.user_message.content,
        timestamp: now,
        attachedFiles: messageFiles.length ? messageFiles : undefined,
      };
      const assistantMessage: Message = {
        id: response.assistant_message.id,
        role: 'assistant',
        content: '',
        timestamp: now,
      };
      setConversations(prev => prev.map(conversation => {
        if (conversation.id !== targetConversation!.id) return conversation;
        const title = conversation.messages.length === 0 && conversation.title.toLowerCase().startsWith('new conversation')
          ? response.user_message.content.slice(0, 42).trim() + (response.user_message.content.length > 42 ? '...' : '')
          : conversation.title;
        return {
          ...conversation,
          title,
          updatedAt: now,
          messages: [...conversation.messages, userMessage],
        };
      }));
      setPendingChatAttachments([]);
      await api.streamMessage(response.stream_url, tokenDelta => {
        setConversations(prev => prev.map(conversation => conversation.id === targetConversation!.id
          ? {
              ...conversation,
              messages: conversation.messages.some(message => message.id === assistantMessage.id)
                ? conversation.messages.map(message => message.id === assistantMessage.id ? { ...message, content: message.content + tokenDelta } : message)
                : [...conversation.messages, { ...assistantMessage, content: tokenDelta }],
            }
          : conversation));
      });
      await loadConversationMessages(targetConversation.id);
    } catch (error) {
      showError(error, 'Could not send message.');
      await loadConversationMessages(targetConversation.id);
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  const uploadFiles = async (files: FileList | File[], projectId: string | null = null): Promise<AttachedFile[]> => {
    const uploaded: AttachedFile[] = [];
    for (const file of Array.from(files)) {
      try {
        const apiFile = await api.uploadFile(file);
        uploaded.push({ ...apiFile, projectId });
      } catch (error) {
        showError(error, `Could not upload ${file.name}.`);
      }
    }
    if (uploaded.length) {
      setLibraryFiles(prev => [...uploaded, ...prev]);
    }
    if (projectId && activeConversationId && uploaded.length) {
      await api.associateConversationFiles(activeConversationId, uploaded.map(file => file.id)).catch(() => undefined);
    }
    return uploaded;
  };

  const deleteFile = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      setLibraryFiles(prev => prev.filter(file => file.id !== fileId));
      setConversations(prev => prev.map(conversation => ({
        ...conversation,
        messages: conversation.messages.map(message => ({
          ...message,
          attachedFiles: message.attachedFiles?.filter(file => file.id !== fileId),
        })),
      })));
    } catch (error) {
      showError(error, 'Could not delete file.');
    }
  };

  const deleteFilesBulk = async (fileIds: string[]) => {
    try {
      await api.deleteFilesBulk(fileIds);
      setLibraryFiles(prev => prev.filter(file => !fileIds.includes(file.id)));
      setConversations(prev => prev.map(conversation => ({
        ...conversation,
        messages: conversation.messages.map(message => ({
          ...message,
          attachedFiles: message.attachedFiles?.filter(file => !fileIds.includes(file.id)),
        })),
      })));
    } catch (error) {
      showError(error, 'Could not delete selected files.');
    }
  };

  const assignFileToProject = async (fileId: string, projectId: string | null) => {
    if (!activeConversationId || !projectId) {
      alert('Files become project context through conversations. Select a project conversation before assigning files.');
      return;
    }
    try {
      await api.associateConversationFiles(activeConversationId, [fileId]);
      await refreshSupervisorData();
    } catch (error) {
      showError(error, 'Could not attach file to the active conversation.');
    }
  };

  const removeFileFromProject = async (projectId: string, fileId: string) => {
    const projectConversations = conversations.filter(conversation => conversation.projectId === projectId);
    if (!projectConversations.length) {
      alert('Project files are derived from conversations, but this project has no conversations to update.');
      return;
    }
    try {
      await Promise.all(projectConversations.map(conversation =>
        api.dissociateConversationFile(conversation.id, fileId).catch(() => undefined)
      ));
      await refreshSupervisorData();
    } catch (error) {
      showError(error, 'Could not remove file from project context.');
    }
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
    setFileToPreview(file);
    api.getFileContent(file.id)
      .then(response => {
        const encoded = btoa(unescape(encodeURIComponent(response.content)));
        setFileToPreview(current => current?.id === file.id ? {
          ...current,
          dataUrl: `data:${response.mime_type};base64,${encoded}`,
        } : current);
      })
      .catch(() => undefined);
  }, [api]);

  const setProjectToEdit = (project: Project | null) => {
    setProjectToEditState(project);
    if (project) {
      api.listProjectFiles(project.id)
        .then(files => {
          setLibraryFiles(prev => {
            const existing = new Map(prev.map(file => [file.id, file]));
            files.forEach(file => existing.set(file.id, { ...file, projectId: project.id }));
            return Array.from(existing.values());
          });
        })
        .catch(() => undefined);
    }
  };

  return (
    <AppContext.Provider
      value={{
        themeMode,
        setThemeMode,
        isDark,
        currentUser,
        login,
        logout,
        updateCurrentUser,
        changeCurrentUserPassword,
        activeAdminView,
        setActiveAdminView,
        supervisors,
        faculties,
        addSupervisor,
        updateSupervisor,
        suspendSupervisor,
        activateSupervisor,
        changeSupervisorPassword,
        deleteSupervisor,
        addFaculty,
        updateFaculty,
        deleteFaculty,
        activeSupervisorView,
        setActiveSupervisorView,
        projects,
        conversations,
        searchConversations,
        activeConversationId,
        setActiveConversationId,
        activeConversation,
        libraryFiles,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        expandedProjectIds,
        toggleProjectExpanded,
        createProject,
        updateProject,
        deleteProject,
        createConversation,
        renameConversation,
        deleteConversation,
        moveConversationToProject,
        sendMessage,
        isGeneratingResponse,
        uploadFiles,
        deleteFile,
        deleteFilesBulk,
        assignFileToProject,
        removeFileFromProject,
        downloadFile,
        isSearchModalOpen,
        setIsSearchModalOpen,
        isCreateProjectModalOpen,
        setIsCreateProjectModalOpen,
        pendingMoveConversationId,
        setPendingMoveConversationId,
        projectToEdit,
        setProjectToEdit,
        isProfileModalOpen,
        setIsProfileModalOpen,
        isAddFromLibraryOpen,
        setIsAddFromLibraryOpen,
        onSelectLibraryFilesForChat,
        setOnSelectLibraryFilesForChat,
        pendingChatAttachments,
        setPendingChatAttachments,
        startConversationWithFiles,
        fileToPreview,
        setFileToPreview,
        previewFile,
        quickLoginAs,
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
