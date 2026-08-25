export type SupervisorStatus = "ACTIVE" | "INACTIVE"

export type Supervisor = {
  id: string
  username: string
  first_name: string
  last_name: string
  email: string
  phone: string
  teaching_year: number
  teaching_semester: string
  faculty: string
  status: SupervisorStatus
  created_at: string
  updated_at: string
}

export type Faculty = {
  id: string
  name: string
}

export type LibraryFile = {
  id: string
  name: string
  size: string
  uploaded_at: string
  project_id: string | null
}

export type Conversation = {
  id: string
  project_id: string | null
  title: string
}

export type Project = {
  id: string
  name: string
  instructions: string
}

export type ChatMessage = {
  id: string
  conversation_id: string
  role: "USER" | "ASSISTANT"
  content: string
  created_at: string
  file_ids: string[]
}

export const facultiesSeed: Faculty[] = [
  { id: "fac-ict", name: "School of Information and Communication Technologies" },
  { id: "fac-sci", name: "School of Science" },
  { id: "fac-bus", name: "School of Business, Law and Entrepreneurship" },
]

export const supervisorsSeed: Supervisor[] = [
  {
    id: "sup-1",
    username: "rzhou",
    first_name: "Rui",
    last_name: "Zhou",
    email: "rzhou@example.edu.au",
    phone: "0400000000",
    teaching_year: 2026,
    teaching_semester: "SEMESTER_2",
    faculty: facultiesSeed[0].name,
    status: "ACTIVE",
    created_at: "2026-08-01",
    updated_at: "2026-08-20",
  },
  {
    id: "sup-2",
    username: "jsmith",
    first_name: "John",
    last_name: "Smith",
    email: "jsmith@example.edu.au",
    phone: "0412345678",
    teaching_year: 2026,
    teaching_semester: "SEMESTER_1",
    faculty: facultiesSeed[1].name,
    status: "INACTIVE",
    created_at: "2026-07-12",
    updated_at: "2026-08-18",
  },
]

export const projectsSeed: Project[] = [
  { id: "proj-alpha", name: "Team Alpha", instructions: "Focus on contribution risks and assessment context." },
  { id: "proj-beta", name: "Team Beta", instructions: "Prioritise project scope and milestone evidence." },
]

export const conversationsSeed: Conversation[] = [
  { id: "conv-1", project_id: "proj-alpha", title: "Contribution issue" },
  { id: "conv-2", project_id: "proj-alpha", title: "Assessment criteria" },
  { id: "conv-3", project_id: null, title: "General capstone policy" },
]

export const filesSeed: LibraryFile[] = [
  { id: "file-1", name: "Capstone-Handbook.pdf", size: "516 KB", uploaded_at: "2026-08-19", project_id: null },
  { id: "file-2", name: "Team-Alpha-Notes.docx", size: "84 KB", uploaded_at: "2026-08-21", project_id: "proj-alpha" },
  { id: "file-3", name: "Milestone-Rubric.pdf", size: "243 KB", uploaded_at: "2026-08-22", project_id: "proj-beta" },
]

export const messagesSeed: ChatMessage[] = [
  {
    id: "msg-1",
    conversation_id: "conv-1",
    role: "USER",
    content: "What should I do if one student misses every team meeting?",
    created_at: "2026-08-24T09:10:00",
    file_ids: ["file-2"],
  },
  {
    id: "msg-2",
    conversation_id: "conv-1",
    role: "ASSISTANT",
    content: "Document the missed meetings, ask the team to record agreed actions, and escalate according to the capstone contribution process.",
    created_at: "2026-08-24T09:10:08",
    file_ids: [],
  },
]
