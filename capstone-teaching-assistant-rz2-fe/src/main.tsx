import * as React from "react"
import { createRoot } from "react-dom/client"
import { Copy, FilePlus, Folder, LogOut, MoreHorizontal, Plus, Search, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Message, MessageBubble } from "@/components/ui/message"
import { MessageScroller } from "@/components/ui/message-scroller"
import { Table, Td, Th } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  conversationsSeed,
  facultiesSeed,
  filesSeed,
  messagesSeed,
  projectsSeed,
  supervisorsSeed,
  type ChatMessage,
  type Conversation,
  type Faculty,
  type LibraryFile,
  type Project,
  type Supervisor,
} from "@/mock-data"
import "./styles.css"

type Page = "login" | "admin-supervisors" | "admin-faculties" | "chat"

function App() {
  const [page, setPage] = React.useState<Page>("login")
  const [user, setUser] = React.useState<{ name: string; role: "Admin" | "Supervisor" } | null>(null)

  if (page === "login") {
    return <LoginPage onLogin={(role) => {
      setUser({ name: role === "Admin" ? "Ada Admin" : "Sam Supervisor", role })
      setPage(role === "Admin" ? "admin-supervisors" : "chat")
    }} />
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex h-14 items-center justify-between border-b bg-white px-4">
        <div className="font-semibold">Capstone Teaching Assistant</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.name}</span>
          <Button variant="outline" size="sm" onClick={() => setPage("login")}><LogOut className="h-4 w-4" /> Logout</Button>
        </div>
      </header>
      {page.startsWith("admin") ? (
        <AdminShell page={page} setPage={setPage} />
      ) : (
        <ChatPage />
      )}
    </div>
  )
}

function LoginPage({ onLogin }: { onLogin: (role: "Admin" | "Supervisor") => void }) {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-muted lg:grid-cols-2">
      <section className="flex items-center justify-center px-6">
        <Card className="w-full max-w-sm p-6">
          <h1 className="text-2xl font-semibold">Capstone Teaching Assistant</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with your username and password.</p>
          <div className="mt-6 space-y-4">
            <Input placeholder="Username" defaultValue="admin" />
            <Input placeholder="Password" type="password" defaultValue="Password123" />
            <Button className="w-full" onClick={() => onLogin("Admin")}>Login as Admin</Button>
            <Button className="w-full" variant="outline" onClick={() => onLogin("Supervisor")}>Login as Supervisor</Button>
          </div>
        </Card>
      </section>
      <section className="hidden bg-primary p-10 text-primary-foreground lg:block">
        <div className="flex h-full items-end text-4xl font-semibold">CTA</div>
      </section>
    </main>
  )
}

function AdminShell({ page, setPage }: { page: Page; setPage: (page: Page) => void }) {
  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[240px_1fr]">
      <aside className="border-r bg-white p-3">
        <div className="mb-4 px-2 text-lg font-semibold">CTA</div>
        <Button className="w-full justify-start" variant={page === "admin-supervisors" ? "default" : "ghost"} onClick={() => setPage("admin-supervisors")}>Supervisor</Button>
        <Button className="mt-1 w-full justify-start" variant={page === "admin-faculties" ? "default" : "ghost"} onClick={() => setPage("admin-faculties")}>Faculty</Button>
      </aside>
      <main className="p-6">{page === "admin-supervisors" ? <SupervisorAdmin /> : <FacultyAdmin />}</main>
    </div>
  )
}

function SupervisorAdmin() {
  const [rows, setRows] = React.useState(supervisorsSeed)
  const [status, setStatus] = React.useState<"ACTIVE" | "INACTIVE">("ACTIVE")
  const [search, setSearch] = React.useState("")
  const [faculty, setFaculty] = React.useState("all")
  const visible = rows.filter((row) =>
    row.status === status &&
    (faculty === "all" || row.faculty === faculty) &&
    `${row.username} ${row.first_name} ${row.last_name} ${row.email} ${row.phone}`.toLowerCase().includes(search.toLowerCase()),
  )

  function addSupervisor() {
    const next: Supervisor = {
      id: crypto.randomUUID(),
      username: `supervisor${rows.length + 1}`,
      first_name: "New",
      last_name: "Supervisor",
      email: `supervisor${rows.length + 1}@example.edu.au`,
      phone: "0499000000",
      teaching_year: 2026,
      teaching_semester: "SEMESTER_2",
      faculty: facultiesSeed[0].name,
      status: "ACTIVE",
      created_at: "2026-08-25",
      updated_at: "2026-08-25",
    }
    setRows([next, ...rows])
  }

  return (
    <section>
      <Toolbar title="Supervisor Management" onAdd={addSupervisor} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search supervisors" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={faculty} onChange={(event) => setFaculty(event.target.value)}>
          <option value="all">All faculties</option>
          {facultiesSeed.map((item) => <option key={item.id}>{item.name}</option>)}
        </select>
        <Button variant={status === "ACTIVE" ? "default" : "outline"} onClick={() => setStatus("ACTIVE")}>Active Supervisor</Button>
        <Button variant={status === "INACTIVE" ? "default" : "outline"} onClick={() => setStatus("INACTIVE")}>Suspended Supervisor</Button>
      </div>
      <DataCard>
        <Table>
          <thead><tr>{["Username", "First name", "Last name", "Full name", "Email", "Phone", "Teaching Year", "Teaching Semester", "Faculty", "Created At", "Updated At", "Actions"].map((h) => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t">
                <Td>{row.username}</Td><Td>{row.first_name}</Td><Td>{row.last_name}</Td><Td>{row.first_name} {row.last_name}</Td><Td>{row.email}</Td><Td>{row.phone}</Td><Td>{row.teaching_year}</Td><Td>{row.teaching_semester}</Td><Td>{row.faculty}</Td><Td>{row.created_at}</Td><Td>{row.updated_at}</Td>
                <Td><Button size="sm" variant="outline" onClick={() => setRows(rows.map((item) => item.id === row.id ? { ...item, status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : item))}>{row.status === "ACTIVE" ? "Suspend" : "Activate"}</Button></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </DataCard>
    </section>
  )
}

function FacultyAdmin() {
  const [rows, setRows] = React.useState<Faculty[]>(facultiesSeed)
  return (
    <section>
      <Toolbar title="Faculty Management" onAdd={() => setRows([{ id: crypto.randomUUID(), name: `New Faculty ${rows.length + 1}` }, ...rows])} />
      <DataCard>
        <Table>
          <thead><tr><Th>Faculty</Th><Th>Actions</Th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-t"><Td>{row.name}</Td><Td><Button size="sm" variant="destructive" onClick={() => setRows(rows.filter((item) => item.id !== row.id))}>Delete</Button></Td></tr>)}</tbody>
        </Table>
      </DataCard>
    </section>
  )
}

function Toolbar({ title, onAdd }: { title: string; onAdd: () => void }) {
  return <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-semibold">{title}</h1><Button onClick={onAdd}><Plus className="h-4 w-4" /> Add</Button></div>
}

function DataCard({ children }: { children: React.ReactNode }) {
  return <Card className="overflow-x-auto">{children}</Card>
}

function ChatPage() {
  const [projects, setProjects] = React.useState(projectsSeed)
  const [conversations, setConversations] = React.useState(conversationsSeed)
  const [messages, setMessages] = React.useState(messagesSeed)
  const [files] = React.useState(filesSeed)
  const [activeId, setActiveId] = React.useState("conv-1")
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0]

  function newConversation(project_id: string | null = null) {
    const next: Conversation = { id: crypto.randomUUID(), project_id, title: "New conversation" }
    setConversations([next, ...conversations])
    setActiveId(next.id)
  }

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[300px_1fr]">
      <aside className="flex flex-col border-r bg-white">
        <div className="flex h-14 items-center justify-between border-b px-4"><strong>CTA</strong><Button size="icon" variant="ghost"><Search className="h-4 w-4" /></Button></div>
        <div className="p-3"><Button className="w-full justify-start" onClick={() => newConversation(null)}><Plus className="h-4 w-4" /> New Conversation</Button></div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">Projects <Button size="icon" variant="ghost" onClick={() => setProjects([...projects, { id: crypto.randomUUID(), name: `Project ${projects.length + 1}`, instructions: "" }])}><Plus className="h-4 w-4" /></Button></div>
          {projects.map((project) => <ProjectGroup key={project.id} project={project} conversations={conversations} activeId={activeId} setActiveId={setActiveId} onNew={() => newConversation(project.id)} />)}
          <div className="mb-2 mt-5 text-xs font-semibold uppercase text-muted-foreground">Chats</div>
          {conversations.filter((item) => !item.project_id).map((item) => <ConversationButton key={item.id} conversation={item} active={item.id === activeId} onClick={() => setActiveId(item.id)} />)}
        </nav>
      </aside>
      <ChatMain conversation={active} messages={messages.filter((item) => item.conversation_id === active.id)} files={files} onSend={(content, file_ids) => {
        const userMessage: ChatMessage = { id: crypto.randomUUID(), conversation_id: active.id, role: "USER", content, created_at: new Date().toISOString(), file_ids }
        const assistant: ChatMessage = { id: crypto.randomUUID(), conversation_id: active.id, role: "ASSISTANT", content: "Mock response: CTA reviewed the conversation context and attached files, then suggested documenting evidence and following the capstone escalation process.", created_at: new Date().toISOString(), file_ids: [] }
        setMessages([...messages, userMessage, assistant])
      }} />
    </div>
  )
}

function ProjectGroup({ project, conversations, activeId, setActiveId, onNew }: { project: Project; conversations: Conversation[]; activeId: string; setActiveId: (id: string) => void; onNew: () => void }) {
  return <div className="mb-2"><div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium"><Folder className="h-4 w-4" /> {project.name}<Button className="ml-auto" size="icon" variant="ghost" onClick={onNew}><Plus className="h-4 w-4" /></Button></div>{conversations.filter((item) => item.project_id === project.id).map((item) => <ConversationButton key={item.id} conversation={item} active={item.id === activeId} onClick={() => setActiveId(item.id)} />)}</div>
}

function ConversationButton({ conversation, active, onClick }: { conversation: Conversation; active: boolean; onClick: () => void }) {
  return <Button className="mt-1 w-full justify-start pl-7" variant={active ? "default" : "ghost"} onClick={onClick}>{conversation.title}<MoreHorizontal className="ml-auto h-4 w-4" /></Button>
}

function ChatMain({ conversation, messages, files, onSend }: { conversation: Conversation; messages: ChatMessage[]; files: LibraryFile[]; onSend: (content: string, file_ids: string[]) => void }) {
  const [content, setContent] = React.useState("")
  const [attached, setAttached] = React.useState<string[]>([])

  return (
    <main className="flex min-w-0 flex-col">
      <div className="flex h-14 items-center justify-between border-b bg-white px-4"><h1 className="font-semibold">{conversation.title}</h1><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></div>
      <MessageScroller className="flex-1 space-y-4 p-6">
        {messages.length === 0 && <div className="mx-auto mt-16 max-w-lg text-center text-muted-foreground">Start a conversation, attach relevant capstone files, and ask CTA for guidance.</div>}
        {messages.map((message) => <Message key={message.id}><MessageBubble isUser={message.role === "USER"}><div>{message.content}</div>{message.file_ids.length > 0 && <div className="mt-2 text-xs opacity-80">{message.file_ids.map((id) => files.find((file) => file.id === id)?.name).join(", ")}</div>}<Button className="mt-2" size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(message.content)}><Copy className="h-3 w-3" /> Copy</Button></MessageBubble></Message>)}
      </MessageScroller>
      <div className="border-t bg-white p-4">
        {attached.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{attached.map((id) => <Button key={id} size="sm" variant="outline" onClick={() => setAttached(attached.filter((item) => item !== id))}>{files.find((file) => file.id === id)?.name} x</Button>)}</div>}
        <div className="flex gap-2">
          <select className="h-10 rounded-md border bg-white px-2 text-sm" onChange={(event) => event.target.value && setAttached([...new Set([...attached, event.target.value])])} value=""><option value="">Attach</option>{files.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}</select>
          <Button size="icon" variant="outline"><FilePlus className="h-4 w-4" /></Button>
          <Textarea className="min-h-10 flex-1" placeholder="Ask CTA..." value={content} onChange={(event) => setContent(event.target.value)} />
          <Button size="icon" onClick={() => { if (!content.trim()) return; onSend(content, attached); setContent(""); setAttached([]) }}><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
