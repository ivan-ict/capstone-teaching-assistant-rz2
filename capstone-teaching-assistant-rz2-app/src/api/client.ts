import { AttachedFile, Conversation, Faculty, Message, Project, User } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

type AccountStatus = 'ACTIVE' | 'INACTIVE';
type UserRoleDTO = 'ADMIN' | 'SUPERVISOR';
type TeachingSemesterDTO = 'SEMESTER_1' | 'SEMESTER_2';

interface LoginResponseDTO {
  id: string;
  username: string;
  role: UserRoleDTO;
  status: AccountStatus;
  access_token: string;
}

interface AccountDTO {
  id: string;
  username: string;
  role: UserRoleDTO;
  status: AccountStatus;
  created_at: string;
  profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    faculty: FacultyDTO;
    teaching_year: number | null;
    teaching_semester: TeachingSemesterDTO | null;
  } | null;
}

interface FacultyDTO {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
  supervisor_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface SupervisorListItemDTO {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  teaching_year: number | null;
  teaching_semester: TeachingSemesterDTO | null;
  status: AccountStatus;
  faculty: {
    id: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface SupervisorDetailDTO {
  id: string;
  username: string;
  status: AccountStatus;
  profile: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    faculty_id: string;
    teaching_year: number | null;
    teaching_semester: TeachingSemesterDTO | null;
  };
}

interface ProjectDTO {
  id: string;
  name: string;
  instructions: string | null;
  created_at?: string;
  updated_at: string;
}

interface ConversationDTO {
  id: string;
  project_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationMessageDTO {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  status: string;
  sequence_no: number;
  files: {
    id: string;
    original_filename: string;
    mime_type?: string | null;
    file_size_bytes: number;
    created_at: string;
  }[];
  sources?: {
    file_id: string;
    original_filename: string;
    content: string;
  }[];
  created_at: string;
}

interface FileDTO {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  processing_status: string;
  processing_error?: string | null;
  created_at: string;
  updated_at?: string;
}

interface FileContentDTO {
  id: string;
  original_filename: string;
  mime_type: string;
  content: string;
}

interface FileBulkDeleteResultDTO {
  deleted_ids: string[];
  failed_ids: string[];
}

interface MessageCreateResponseDTO {
  user_message: {
    id: string;
    role: 'USER';
    content: string;
    status: string;
    sequence_no: number;
  };
  assistant_message: {
    id: string;
    role: 'ASSISTANT';
    content: string;
    status: string;
    sequence_no: number;
  };
  stream_url: string;
}

interface ApiClientOptions {
  getToken: () => string | null;
  setToken: (token: string | null) => void;
}

export class ApiClient {
  private getToken: () => string | null;
  private setToken: (token: string | null) => void;

  constructor(options: ApiClientOptions) {
    this.getToken = options.getToken;
    this.setToken = options.setToken;
  }

  async login(username: string, password: string): Promise<LoginResponseDTO> {
    const response = await this.request<LoginResponseDTO>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    });
    this.setToken(response.access_token);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Local logout must still clear client state if the token is already expired or revoked.
    } finally {
      this.setToken(null);
    }
  }

  getAccount(): Promise<AccountDTO> {
    return this.request<AccountDTO>('/account');
  }

  changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request('/account/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  async listFaculties(): Promise<Faculty[]> {
    const response = await this.request<{ items: FacultyDTO[] }>('/faculties');
    return response.items.map(mapFaculty);
  }

  async listAdminFaculties(search = ''): Promise<Faculty[]> {
    const searchParams = new URLSearchParams({ page: '1', page_size: '100', include_inactive: 'true' });
    if (search) searchParams.set('search', search);
    const response = await this.request<{ items: FacultyDTO[] }>(`/admin/faculties?${searchParams}`);
    return response.items.map(mapFaculty);
  }

  async createFaculty(data: Pick<Faculty, 'name' | 'code'>): Promise<Faculty> {
    const response = await this.request<FacultyDTO>('/admin/faculties', {
      method: 'POST',
      body: JSON.stringify({ name: data.name, code: data.code }),
    });
    return mapFaculty(response);
  }

  async updateFaculty(id: string, data: Partial<Faculty>): Promise<Faculty> {
    const response = await this.request<FacultyDTO>(`/admin/faculties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
      }),
    });
    return mapFaculty(response);
  }

  async deleteFaculty(id: string): Promise<void> {
    await this.request(`/admin/faculties/${id}`, { method: 'DELETE' });
  }

  async listSupervisors(params: { search?: string; status?: AccountStatus } = {}): Promise<User[]> {
    const searchParams = new URLSearchParams({ page: '1', page_size: '100' });
    if (params.search) searchParams.set('search', params.search);
    if (params.status) searchParams.set('status', params.status);
    const response = await this.request<{ items: SupervisorListItemDTO[] }>(`/admin/supervisors?${searchParams}`);
    return response.items.map(mapSupervisorListItem);
  }

  async getSupervisor(id: string): Promise<User> {
    const [dto, faculties] = await Promise.all([
      this.request<SupervisorDetailDTO>(`/admin/supervisors/${id}`),
      this.listFaculties(),
    ]);
    return mapSupervisorDetail(dto, faculties);
  }

  async createSupervisor(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'fullName' | 'role' | 'status'>, faculties: Faculty[]): Promise<User> {
    const faculty = findFaculty(faculties, data.faculty);
    const dto = await this.request<SupervisorDetailDTO | { id: string; username: string; status: AccountStatus; profile: SupervisorDetailDTO['profile'] }>('/admin/supervisors', {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        password: data.password,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone || null,
        faculty_id: faculty?.id || data.faculty,
        teaching_year: data.teachingYear ? Number(data.teachingYear) : null,
        teaching_semester: toApiSemester(data.teachingSemester),
      }),
    });
    return mapSupervisorDetail(dto as SupervisorDetailDTO, faculties);
  }

  async updateSupervisor(id: string, data: Partial<User>, faculties: Faculty[]): Promise<void> {
    const faculty = data.faculty ? findFaculty(faculties, data.faculty) : null;
    await this.request(`/admin/supervisors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.firstName !== undefined ? { first_name: data.firstName } : {}),
        ...(data.lastName !== undefined ? { last_name: data.lastName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.faculty !== undefined ? { faculty_id: faculty?.id || data.faculty } : {}),
        ...(data.teachingYear !== undefined ? { teaching_year: data.teachingYear ? Number(data.teachingYear) : null } : {}),
        ...(data.teachingSemester !== undefined ? { teaching_semester: toApiSemester(data.teachingSemester) } : {}),
      }),
    });
  }

  updateSupervisorStatus(id: string, status: AccountStatus): Promise<{ id: string; status: AccountStatus }> {
    return this.request(`/admin/supervisors/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  resetSupervisorPassword(id: string, newPassword: string): Promise<{ id: string; message: string }> {
    return this.request(`/admin/supervisors/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  deleteSupervisor(id: string): Promise<void> {
    return this.request(`/admin/supervisors/${id}`, { method: 'DELETE' });
  }

  async listProjects(): Promise<Project[]> {
    const response = await this.request<{ items: ProjectDTO[] }>('/projects');
    return response.items.map(mapProject);
  }

  async createProject(name: string, instructions?: string): Promise<Project> {
    const response = await this.request<ProjectDTO>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, instructions: instructions || null }),
    });
    return mapProject(response);
  }

  async updateProject(id: string, name: string, instructions?: string): Promise<void> {
    await this.request(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, instructions: instructions || null }),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  async listProjectFiles(projectId: string): Promise<AttachedFile[]> {
    const response = await this.request<{ items: FileDTO[] }>(`/projects/${projectId}/files`);
    return response.items.map(file => mapFile(file, [projectId]));
  }

  async listConversations(): Promise<Conversation[]> {
    const response = await this.request<{ items: ConversationDTO[] }>('/conversations?page=1&page_size=100');
    return response.items.map(mapConversation);
  }

  async searchConversations(query: string): Promise<Conversation[]> {
    const params = new URLSearchParams({ query, page: '1', page_size: '100' });
    const response = await this.request<{ items: ConversationDTO[] }>(`/conversations/search?${params}`);
    return response.items.map(mapConversation);
  }

  async createConversation(projectId: string | null = null): Promise<Conversation> {
    const response = await this.request<ConversationDTO>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    });
    return mapConversation(response);
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await this.request(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  async moveConversation(id: string, projectId: string | null): Promise<void> {
    await this.request(`/conversations/${id}/project`, {
      method: 'PATCH',
      body: JSON.stringify({ project_id: projectId }),
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.request(`/conversations/${id}`, { method: 'DELETE' });
  }

  async listConversationMessages(conversationId: string): Promise<Message[]> {
    const response = await this.request<{ items: ConversationMessageDTO[] }>(`/conversations/${conversationId}/messages`);
    return response.items.map(mapMessage);
  }

  async listConversationFiles(conversationId: string): Promise<AttachedFile[]> {
    const response = await this.request<{ items: FileDTO[] }>(`/conversations/${conversationId}/files`);
    return response.items.map(file => mapFile(file));
  }

  async associateConversationFiles(conversationId: string, fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;
    await this.request(`/conversations/${conversationId}/files`, {
      method: 'POST',
      body: JSON.stringify({ file_ids: fileIds }),
    });
  }

  async dissociateConversationFile(conversationId: string, fileId: string): Promise<void> {
    await this.request(`/conversations/${conversationId}/files/${fileId}`, { method: 'DELETE' });
  }

  async listFiles(search = ''): Promise<AttachedFile[]> {
    const searchParams = new URLSearchParams({ page: '1', page_size: '100' });
    if (search) searchParams.set('search', search);
    const response = await this.request<{ items: FileDTO[] }>(`/files?${searchParams}`);
    return response.items.map(file => mapFile(file));
  }

  async uploadFile(file: File): Promise<AttachedFile> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.request<FileDTO>('/files', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
    return mapFile(response);
  }

  async deleteFile(id: string): Promise<void> {
    await this.request(`/files/${id}`, { method: 'DELETE' });
  }

  async deleteFilesBulk(ids: string[]): Promise<{ deletedIds: string[]; failedIds: string[] }> {
    if (!ids.length) return { deletedIds: [], failedIds: [] };
    const response = await this.request<FileBulkDeleteResultDTO>('/files/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ file_ids: ids }),
    });
    return {
      deletedIds: response.deleted_ids,
      failedIds: response.failed_ids,
    };
  }

  async getFileContent(id: string): Promise<FileContentDTO> {
    return this.request(`/files/${id}/content`);
  }

  downloadUrl(id: string): string {
    return `${API_BASE_URL}/files/${id}/download`;
  }

  async downloadFile(id: string): Promise<Blob> {
    const response = await fetch(this.downloadUrl(id), {
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      await throwResponseError(response);
    }
    return response.blob();
  }

  async createMessage(conversationId: string, content: string, fileIds: string[]): Promise<MessageCreateResponseDTO> {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, file_ids: fileIds }),
    });
  }

  async streamMessage(streamUrl: string, onToken: (token: string) => void): Promise<void> {
    const response = await fetch(toAbsoluteApiUrl(streamUrl), {
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      await throwResponseError(response);
    }
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';
      for (const chunk of chunks) {
        const event = parseSseChunk(chunk);
        if (event.event === 'token' && event.data?.delta) {
          onToken(event.data.delta);
        }
        if (event.event === 'error') {
          throw new ApiClientError(500, event.data?.code || 'AI_GENERATION_FAILED', event.data?.message || 'AI response generation failed.');
        }
      }
    }
  }

  private async request<T>(path: string, options: RequestInit & { skipAuth?: boolean; isMultipart?: boolean } = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (!options.isMultipart) {
      headers.set('Content-Type', 'application/json');
    }
    if (!options.skipAuth) {
      for (const [key, value] of Object.entries(this.authHeaders())) {
        headers.set(key, value);
      }
    }

    const response = await fetch(toAbsoluteApiUrl(path), {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return undefined as T;
    }
    if (!response.ok) {
      await throwResponseError(response);
    }
    return response.json();
  }

  private authHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

export function mapAccount(dto: AccountDTO): User {
  const profile = dto.profile;
  return {
    id: dto.id,
    username: dto.username,
    firstName: profile?.first_name || dto.username,
    lastName: profile?.last_name || '',
    fullName: `${profile?.first_name || dto.username} ${profile?.last_name || ''}`.trim(),
    email: profile?.email || '',
    phone: profile?.phone || '',
    teachingYear: profile?.teaching_year ? String(profile.teaching_year) : '',
    teachingSemester: fromApiSemester(profile?.teaching_semester),
    faculty: profile?.faculty.name || '',
    role: dto.role === 'ADMIN' ? 'admin' : 'supervisor',
    status: dto.status === 'ACTIVE' ? 'active' : 'suspended',
    createdAt: dto.created_at,
    updatedAt: '',
  };
}

export function toApiSemester(value?: string | null): TeachingSemesterDTO | null {
  if (value === 'Semester 1' || value === 'SEMESTER_1') return 'SEMESTER_1';
  if (value === 'Semester 2' || value === 'SEMESTER_2') return 'SEMESTER_2';
  if (!value) return null;
  throw new ApiClientError(422, 'UNSUPPORTED_SEMESTER', 'The backend only supports Semester 1 and Semester 2.');
}

function fromApiSemester(value?: TeachingSemesterDTO | null): string {
  if (value === 'SEMESTER_1') return 'Semester 1';
  if (value === 'SEMESTER_2') return 'Semester 2';
  return '';
}

function mapFaculty(dto: FacultyDTO): Faculty {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    departmentHead: 'Unassigned',
    activeSupervisorsCount: dto.supervisor_count,
    createdAt: dto.created_at || '',
    updatedAt: dto.updated_at || '',
  };
}

function mapSupervisorListItem(dto: SupervisorListItemDTO): User {
  return {
    id: dto.id,
    username: dto.username,
    firstName: dto.first_name,
    lastName: dto.last_name,
    fullName: `${dto.first_name} ${dto.last_name}`.trim(),
    email: dto.email,
    phone: dto.phone || '',
    teachingYear: dto.teaching_year ? String(dto.teaching_year) : '',
    teachingSemester: fromApiSemester(dto.teaching_semester),
    faculty: dto.faculty.name,
    role: 'supervisor',
    status: dto.status === 'ACTIVE' ? 'active' : 'suspended',
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function mapSupervisorDetail(dto: SupervisorDetailDTO, faculties: Faculty[]): User {
  const faculty = faculties.find(f => f.id === dto.profile.faculty_id);
  const firstName = dto.profile.first_name || '';
  const lastName = dto.profile.last_name || '';
  return {
    id: dto.id,
    username: dto.username,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: dto.profile.email,
    phone: dto.profile.phone || '',
    teachingYear: dto.profile.teaching_year ? String(dto.profile.teaching_year) : '',
    teachingSemester: fromApiSemester(dto.profile.teaching_semester),
    faculty: faculty?.name || dto.profile.faculty_id,
    role: 'supervisor',
    status: dto.status === 'ACTIVE' ? 'active' : 'suspended',
    createdAt: '',
    updatedAt: '',
  };
}

function mapProject(dto: ProjectDTO): Project {
  return {
    id: dto.id,
    name: dto.name,
    instructions: dto.instructions || '',
    createdAt: dto.created_at || dto.updated_at,
    updatedAt: dto.updated_at,
  };
}

function mapConversation(dto: ConversationDTO): Conversation {
  return {
    id: dto.id,
    title: dto.title,
    projectId: dto.project_id,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    messages: [],
  };
}

function mapMessage(dto: ConversationMessageDTO): Message {
  return {
    id: dto.id,
    role: dto.role === 'USER' ? 'user' : 'assistant',
    content: dto.content,
    timestamp: dto.created_at,
    attachedFiles: dto.files.map(file => ({
      id: file.id,
      name: file.original_filename,
      size: file.file_size_bytes,
      type: file.mime_type || 'application/octet-stream',
      uploadedAt: file.created_at,
      isImage: Boolean(file.mime_type?.startsWith('image/')),
    })),
    references: dto.sources?.map(source => ({
      fileId: source.file_id,
      filename: source.original_filename,
      content: source.content,
    })),
  };
}

function mapFile(dto: FileDTO, projectIds: string[] = []): AttachedFile {
  return {
    id: dto.id,
    name: dto.original_filename,
    size: dto.file_size_bytes,
    type: dto.mime_type,
    uploadedAt: dto.created_at,
    projectIds,
    isImage: dto.mime_type.startsWith('image/'),
  };
}

function findFaculty(faculties: Faculty[], value: string): Faculty | undefined {
  return faculties.find(f => f.id === value || f.name === value || f.code === value);
}

function toAbsoluteApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/api/v1/')) return `${API_BASE_URL}${path.slice('/api/v1'.length)}`;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}

async function throwResponseError(response: Response): Promise<never> {
  let code = `HTTP_${response.status}`;
  let message = response.statusText || 'Request failed.';
  try {
    const payload = await response.json();
    if (payload?.error) {
      code = payload.error.code || code;
      message = payload.error.message || message;
    }
  } catch {
    // Response had no JSON error body.
  }
  throw new ApiClientError(response.status, code, message);
}

function parseSseChunk(chunk: string): { event?: string; data?: any } {
  const lines = chunk.split('\n');
  const eventLine = lines.find(line => line.startsWith('event:'));
  const dataLine = lines.find(line => line.startsWith('data:'));
  const dataText = dataLine?.slice('data:'.length).trim();
  let data: any = undefined;
  if (dataText) {
    try {
      data = JSON.parse(dataText);
    } catch {
      data = dataText;
    }
  }
  return {
    event: eventLine?.slice('event:'.length).trim(),
    data,
  };
}
