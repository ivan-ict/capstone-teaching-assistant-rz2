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
  semester?: Semester;
  semesterId?: string;
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
  dataUrl?: string; // for thumbnail / preview
  isPreviewLoading?: boolean;
  previewError?: string;
  isImage?: boolean;
  processingStatus?: 'PROCESSING' | 'READY' | 'FAILED';
  processingError?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO format
  references?: MessageReference[];
}

export interface MessageReference {
  fileId: string;
  filename: string;
  mimeType?: string;
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  semesterId: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface Semester {
  id: string;
  name: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
  deleted_at: string | null;
  created_at?: string;
  updated_at?: string;
  file_count?: number;
  supervisor_count?: number;
  ready_file_count?: number;
}

export type SemesterInput = Pick<Semester, 'name' | 'year' | 'start_date' | 'end_date'>;
export interface SemesterSupervisor {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  status: 'ACTIVE' | 'INACTIVE';
  semester: Semester;
}
export interface Page<T> { items: T[]; total: number; page: number; page_size: number; }

export type ThemeMode = 'system' | 'dark' | 'light';

export type AdminActiveView = 'supervisors' | 'faculties' | 'semesters';
export type SupervisorActiveView = 'chat';
