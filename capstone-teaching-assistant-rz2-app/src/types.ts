export type UserRole = 'admin' | 'supervisor';

export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string;
  username: string;
  password?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  teachingYear: string;
  teachingSemester: string;
  faculty: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  avatarColor?: string;
}

export interface Faculty {
  id: string;
  name: string;
  code: string;
  departmentHead: string;
  activeSupervisorsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number; // in bytes
  type: string; // mime or extension e.g. 'image/png', 'application/pdf', 'code', etc.
  uploadedAt: string;
  projectIds?: string[]; // empty or undefined means 'Uncategorised'
  dataUrl?: string; // for thumbnail / preview
  isPreviewLoading?: boolean;
  previewError?: string;
  isImage?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO format
  attachedFiles?: AttachedFile[];
  references?: string[]; // references to documents/project context
}

export interface Conversation {
  id: string;
  title: string;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface Project {
  id: string;
  name: string;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
  color?: string;
}

export type ThemeMode = 'system' | 'dark' | 'light';

export type AdminActiveView = 'supervisors' | 'faculties';
export type SupervisorActiveView = 'chat' | 'library';
