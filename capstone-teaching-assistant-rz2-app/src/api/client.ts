import { AttachedFile, Conversation, Faculty, Message, Semester, SemesterInput, SemesterSupervisor, Page, User } from '../types';

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

export type SortOrder = 'asc' | 'desc';
export interface Sort {
  by: string;
  order: SortOrder;
}

const withSort = (params: URLSearchParams, sort?: Sort | null) => {
  if (sort) {
    params.set('sort_by', sort.by);
    params.set('sort_order', sort.order);
  }
  return params;
};
type UserRoleDTO = 'ADMIN' | 'SUPERVISOR';

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
    semester: Semester;
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
  semester: Semester;
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
    semester: Semester;
  };
}

interface ConversationDTO {
  id: string;
  semester_id: string;
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
  sources?: {
    file_id: string;
    original_filename: string;
    mime_type?: string | null;
    content: string;
  }[];
  created_at: string;
}

interface FileDTO {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  processing_status: 'PROCESSING' | 'READY' | 'FAILED';
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
  conversation_title: string;
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

  forgotPassword(identifier: string): Promise<{ message: string }> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
      skipAuth: true,
    });
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
    const items: FacultyDTO[] = [];
    for (let page = 1; ; page++) {
      const searchParams = new URLSearchParams({ page: String(page), page_size: '100', include_inactive: 'true' });
      if (search) searchParams.set('search', search);
      const response = await this.request<Page<FacultyDTO>>(`/admin/faculties?${searchParams}`);
      items.push(...response.items);
      if (items.length >= response.total || !response.items.length) return items.map(mapFaculty);
    }
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
    // Fetch every page: the admin table filters, sorts and pages this list on the client.
    const items: SupervisorListItemDTO[] = [];
    for (let page = 1; ; page++) {
      const searchParams = new URLSearchParams({ page: String(page), page_size: '100' });
      if (params.search) searchParams.set('search', params.search);
      if (params.status) searchParams.set('status', params.status);
      const response = await this.request<Page<SupervisorListItemDTO>>(`/admin/supervisors?${searchParams}`);
      items.push(...response.items);
      if (items.length >= response.total || !response.items.length) return items.map(mapSupervisorListItem);
    }
  }

  async getSupervisor(id: string): Promise<User> {
    const [dto, faculties] = await Promise.all([
      this.request<SupervisorDetailDTO>(`/admin/supervisors/${id}`),
      this.listFaculties(),
    ]);
    return mapSupervisorDetail(dto, faculties);
  }

  async createSupervisor(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'fullName' | 'role' | 'status' | 'password'>, faculties: Faculty[]): Promise<User> {
    const faculty = findFaculty(faculties, data.faculty);
    const dto = await this.request<SupervisorDetailDTO | { id: string; username: string; status: AccountStatus; profile: SupervisorDetailDTO['profile'] }>('/admin/supervisors', {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone || null,
        faculty_id: faculty?.id || data.faculty,
        semester_id: data.semesterId,
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
      }),
    });
  }

  updateSupervisorStatus(id: string, status: AccountStatus): Promise<{ id: string; status: AccountStatus }> {
    return this.request(`/admin/supervisors/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  resetSupervisorPassword(id: string): Promise<{ id: string; email: string; message: string }> {
    return this.request(`/admin/supervisors/${id}/password-reset`, { method: 'POST' });
  }

  deleteSupervisor(id: string): Promise<void> {
    return this.request(`/admin/supervisors/${id}`, { method: 'DELETE' });
  }

  listSemesters(archived = false, search = '', page = 1, sort?: Sort | null): Promise<Page<Semester>> {
    const params = new URLSearchParams({ archived: String(archived), search, page: String(page), page_size: '20' });
    return this.request(`/admin/semesters?${withSort(params, sort)}`);
  }

  async activeSemesters(): Promise<Semester[]> {
    const items: Semester[] = [];
    let page = 1;
    while (true) {
      const result = await this.listSemesters(false, '', page++);
      items.push(...result.items);
      if (items.length >= result.total || !result.items.length) return items;
    }
  }

  saveSemester(data: SemesterInput, id?: string): Promise<Semester> {
    return this.request(`/admin/semesters${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(data) });
  }

  archiveSemester(id: string): Promise<void> {
    return this.request(`/admin/semesters/${id}`, { method: 'DELETE' });
  }

  semesterSupervisors(id: string, candidates = false, search = '', page = 1, sort?: Sort | null): Promise<Page<SemesterSupervisor>> {
    const params = withSort(new URLSearchParams({ search, page: String(page), page_size: '20' }), sort);
    return this.request(`/admin/semesters/${id}/${candidates ? 'supervisor-candidates' : 'supervisors'}?${params}`);
  }

  assignSupervisors(id: string, supervisorIds: string[]): Promise<{ moved_count: number }> {
    return this.request(`/admin/semesters/${id}/supervisors`, { method: 'POST', body: JSON.stringify({ supervisor_ids: supervisorIds }) });
  }

  async semesterFiles(id: string, page = 1, options: { search?: string; sort?: Sort | null } = {}): Promise<Page<AttachedFile>> {
    const params = withSort(new URLSearchParams({ page: String(page), page_size: '20' }), options.sort);
    if (options.search) params.set('search', options.search);
    const result = await this.request<Page<FileDTO>>(`/admin/semesters/${id}/files?${params}`);
    return { ...result, items: result.items.map(mapFile) };
  }

  async uploadSemesterFile(id: string, file: File): Promise<AttachedFile> {
    const body = new FormData();
    body.append('file', file);
    return mapFile(await this.request<FileDTO>(`/admin/semesters/${id}/files`, { method: 'POST', body, isMultipart: true }));
  }

  deleteSemesterFile(semesterId: string, fileId: string): Promise<void> {
    return this.request(`/admin/semesters/${semesterId}/files/${fileId}`, { method: 'DELETE' });
  }

  async listConversations(): Promise<Conversation[]> {
    const items: Conversation[] = [];
    let page = 1;
    while (true) {
      const response = await this.request<Page<ConversationDTO>>(`/conversations?page=${page++}&page_size=100`);
      items.push(...response.items.map(mapConversation));
      if (items.length >= response.total || !response.items.length) return items;
    }
  }

  async searchConversations(query: string): Promise<Conversation[]> {
    const items: Conversation[] = [];
    let page = 1;
    while (true) {
      const params = new URLSearchParams({ query, page: String(page++), page_size: '100' });
      const response = await this.request<Page<ConversationDTO>>(`/conversations/search?${params}`);
      items.push(...response.items.map(mapConversation));
      if (items.length >= response.total || !response.items.length) return items;
    }
  }

  async createConversation(): Promise<Conversation> {
    const response = await this.request<ConversationDTO>('/conversations', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return mapConversation(response);
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await this.request(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.request(`/conversations/${id}`, { method: 'DELETE' });
  }

  async listConversationMessages(conversationId: string): Promise<Message[]> {
    const response = await this.request<{ items: ConversationMessageDTO[] }>(`/conversations/${conversationId}/messages`);
    return response.items.map(mapMessage);
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

  async createMessage(conversationId: string, content: string): Promise<MessageCreateResponseDTO> {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async streamMessage(streamUrl: string, onToken: (token: string) => void, signal?: AbortSignal): Promise<void> {
    const response = await fetch(toAbsoluteApiUrl(streamUrl), {
      signal,
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
    semester: profile?.semester,
    semesterId: profile?.semester.id,
    faculty: profile?.faculty.name || '',
    role: dto.role === 'ADMIN' ? 'admin' : 'supervisor',
    status: dto.status === 'ACTIVE' ? 'active' : 'suspended',
    createdAt: dto.created_at,
    updatedAt: '',
  };
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
    semester: dto.semester,
    semesterId: dto.semester.id,
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
    semester: dto.profile.semester,
    semesterId: dto.profile.semester.id,
    faculty: faculty?.name || dto.profile.faculty_id,
    role: 'supervisor',
    status: dto.status === 'ACTIVE' ? 'active' : 'suspended',
    createdAt: '',
    updatedAt: '',
  };
}

function mapConversation(dto: ConversationDTO): Conversation {
  return {
    id: dto.id,
    title: dto.title,
    semesterId: dto.semester_id,
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
    references: dto.sources?.map(source => ({
      fileId: source.file_id,
      filename: source.original_filename,
      mimeType: source.mime_type ?? undefined,
      content: source.content,
    })),
  };
}

function mapFile(dto: FileDTO): AttachedFile {
  return {
    id: dto.id,
    name: dto.original_filename,
    size: dto.file_size_bytes,
    type: dto.mime_type,
    uploadedAt: dto.created_at,
    isImage: dto.mime_type.startsWith('image/'),
    processingStatus: dto.processing_status,
    processingError: dto.processing_error || undefined,
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
