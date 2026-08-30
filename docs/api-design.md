# Capstone Teaching Assistant — API Specification

Base URL:

```text
/api/v1
```

Authentication is required for all endpoints except `POST /auth/login`.
Authenticated requests use the bearer token returned by login:

```text
Authorization: Bearer <access_token>
```

---

# 1. Authentication

## `POST /auth/login`

Authenticates Admin or Supervisor.

### Request

```json
{
  "username": "rzhou",
  "password": "Password123"
}
```

### Response — `200`

```json
{
  "id": "user-uuid",
  "username": "rzhou",
  "role": "SUPERVISOR",
  "status": "ACTIVE",
  "access_token": "jwt-access-token",
  "token_type": "bearer"
}
```

### Error — `401`

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password."
  }
}
```

---

## `POST /auth/logout`

Revokes the current bearer token.

### Request

No body.

### Response — `204`

```text
No Content
```

---

# 2. Account

## `GET /account`

Returns the current authenticated user's account information.

### Response — Supervisor

```json
{
  "id": "user-uuid",
  "username": "rzhou",
  "role": "SUPERVISOR",
  "status": "ACTIVE",
  "profile": {
    "first_name": "Rui",
    "last_name": "Zhou",
    "email": "rzhou@example.edu.au",
    "phone": "0400000000",
    "faculty": {
      "id": "faculty-uuid",
      "code": "SCI",
      "name": "School of Science"
    },
    "teaching_year": 2026,
    "teaching_semester": "SEMESTER_2"
  }
}
```

---

## `PUT /account/password`

Changes the current user's password.

### Request

```json
{
  "current_password": "Password123",
  "new_password": "NewPassword456"
}
```

### Response — `200`

```json
{
  "message": "Password changed successfully."
}
```

---

# 3. Faculties

## `GET /faculties`

Returns active Faculty values for dropdown selection.

### Response — `200`

```json
{
  "items": [
    {
      "id": "faculty-uuid",
      "code": "SCI",
      "name": "School of Science"
    }
  ]
}
```

---

# 4. Admin — Supervisors

## `POST /admin/supervisors`

Creates a Supervisor account.

### Request

```json
{
  "username": "jsmith",
  "password": "Password123",
  "first_name": "John",
  "last_name": "Smith",
  "email": "jsmith@example.edu.au",
  "phone": "0412345678",
  "faculty_id": "faculty-uuid",
  "teaching_year": 2026,
  "teaching_semester": "SEMESTER_2"
}
```

### Response — `201`

```json
{
  "id": "supervisor-uuid",
  "username": "jsmith",
  "status": "ACTIVE",
  "profile": {
    "first_name": "John",
    "last_name": "Smith",
    "email": "jsmith@example.edu.au",
    "faculty_id": "faculty-uuid",
    "teaching_year": 2026,
    "teaching_semester": "SEMESTER_2"
  }
}
```

---

## `GET /admin/supervisors`

Lists Supervisor accounts.

### Query Parameters

```text
search
faculty_id
status
page
page_size
```

Example:

```text
GET /admin/supervisors?search=rui&faculty_id=faculty-uuid&page=1&page_size=20
```

### Response — `200`

```json
{
  "items": [
    {
      "id": "supervisor-uuid",
      "username": "rzhou",
      "first_name": "Rui",
      "last_name": "Zhou",
      "email": "rzhou@example.edu.au",
      "status": "ACTIVE",
      "faculty": {
        "id": "faculty-uuid",
        "name": "School of Science"
      }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

---

## `GET /admin/supervisors/{supervisor_id}`

Returns one Supervisor.

### Response — `200`

```json
{
  "id": "supervisor-uuid",
  "username": "rzhou",
  "status": "ACTIVE",
  "profile": {
    "first_name": "Rui",
    "last_name": "Zhou",
    "email": "rzhou@example.edu.au",
    "phone": "0400000000",
    "faculty_id": "faculty-uuid",
    "teaching_year": 2026,
    "teaching_semester": "SEMESTER_2"
  }
}
```

---

## `PATCH /admin/supervisors/{supervisor_id}`

Updates Supervisor profile information.

### Request

```json
{
  "email": "rui.zhou@example.edu.au",
  "phone": "0499999999",
  "faculty_id": "faculty-uuid",
  "teaching_year": 2026,
  "teaching_semester": "SEMESTER_1"
}
```

### Response — `200`

```json
{
  "id": "supervisor-uuid",
  "profile": {
    "email": "rui.zhou@example.edu.au",
    "phone": "0499999999",
    "faculty_id": "faculty-uuid",
    "teaching_year": 2026,
    "teaching_semester": "SEMESTER_1"
  }
}
```

---

## `PATCH /admin/supervisors/{supervisor_id}/status`

Activates or deactivates a Supervisor.

### Request

```json
{
  "status": "INACTIVE"
}
```

### Response — `200`

```json
{
  "id": "supervisor-uuid",
  "status": "INACTIVE"
}
```

---

# 5. Projects

## `POST /projects`

Creates a Project.

### Request

```json
{
  "name": "Team Alpha",
  "instructions": "Focus on Team Alpha and identify project risks."
}
```

### Response — `201`

```json
{
  "id": "project-uuid",
  "name": "Team Alpha",
  "instructions": "Focus on Team Alpha and identify project risks.",
  "created_at": "2026-08-23T05:00:00Z"
}
```

---

## `GET /projects`

Lists Projects owned by the current Supervisor.

### Response — `200`

```json
{
  "items": [
    {
      "id": "project-uuid",
      "name": "Team Alpha",
      "instructions": "Focus on Team Alpha.",
      "updated_at": "2026-08-23T05:00:00Z"
    }
  ]
}
```

---

## `GET /projects/{project_id}`

Returns one Project.

### Response — `200`

```json
{
  "id": "project-uuid",
  "name": "Team Alpha",
  "instructions": "Focus on Team Alpha.",
  "created_at": "2026-08-23T05:00:00Z",
  "updated_at": "2026-08-23T05:00:00Z"
}
```

---

## `PATCH /projects/{project_id}`

Updates Project name and/or AI instructions.

### Request

```json
{
  "name": "Team Alpha 2026",
  "instructions": "Prioritise Team Alpha documents."
}
```

### Response — `200`

```json
{
  "id": "project-uuid",
  "name": "Team Alpha 2026",
  "instructions": "Prioritise Team Alpha documents."
}
```

---

## `DELETE /projects/{project_id}`

Deletes a Project.

Conversations belonging to it become unprojected.

### Response — `204`

```text
No Content
```

---

## `GET /projects/{project_id}/files`

Returns Files associated with Conversations currently belonging to the Project.

### Response — `200`

```json
{
  "items": [
    {
      "id": "file-uuid",
      "original_filename": "Capstone-Handbook.pdf",
      "mime_type": "application/pdf",
      "file_size_bytes": 528944,
      "processing_status": "READY"
    }
  ]
}
```

---

# 6. Conversations

## `POST /conversations`

Creates a Conversation.

### Request — Project Conversation

```json
{
  "project_id": "project-uuid"
}
```

### Request — Unprojected Conversation

```json
{
  "project_id": null
}
```

### Response — `201`

```json
{
  "id": "conversation-uuid",
  "project_id": "project-uuid",
  "title": "New conversation",
  "created_at": "2026-08-23T05:15:00Z"
}
```

---

## `GET /conversations`

Lists Conversations.

Optional:

```text
project_id
```

Example:

```text
GET /conversations?project_id=project-uuid
```

### Response — `200`

```json
{
  "items": [
    {
      "id": "conversation-uuid",
      "project_id": "project-uuid",
      "title": "Managing Team Contribution",
      "updated_at": "2026-08-23T05:20:00Z"
    }
  ]
}
```

---

## `GET /conversations/{conversation_id}`

Returns Conversation metadata.

### Response — `200`

```json
{
  "id": "conversation-uuid",
  "project": {
    "id": "project-uuid",
    "name": "Team Alpha"
  },
  "title": "Managing Team Contribution",
  "created_at": "2026-08-23T05:15:00Z",
  "updated_at": "2026-08-23T05:20:00Z"
}
```

---

## `PATCH /conversations/{conversation_id}`

Renames a Conversation.

### Request

```json
{
  "title": "Team Alpha Contribution Issue"
}
```

### Response — `200`

```json
{
  "id": "conversation-uuid",
  "title": "Team Alpha Contribution Issue"
}
```

---

## `PATCH /conversations/{conversation_id}/project`

Moves a Conversation to another Project or removes it from a Project.

### Move

```json
{
  "project_id": "new-project-uuid"
}
```

### Remove From Project

```json
{
  "project_id": null
}
```

### Response — `200`

```json
{
  "id": "conversation-uuid",
  "project_id": "new-project-uuid"
}
```

---

## `DELETE /conversations/{conversation_id}`

Deletes the Conversation and its Messages.

Files themselves remain.

### Response — `204`

```text
No Content
```

---

## `GET /conversations/{conversation_id}/messages`

Returns Conversation Messages and attached Files.

### Response — `200`

```json
{
  "items": [
    {
      "id": "message-1-uuid",
      "role": "USER",
      "content": "What should I do about this team issue?",
      "status": "COMPLETED",
      "sequence_no": 1,
      "files": [
        {
          "id": "file-uuid",
          "original_filename": "Team-Notes.pdf"
        }
      ]
    },
    {
      "id": "message-2-uuid",
      "role": "ASSISTANT",
      "content": "You should first discuss the issue with the team...",
      "status": "COMPLETED",
      "sequence_no": 2,
      "files": []
    }
  ]
}
```

---

## `GET /conversations/{conversation_id}/files`

Returns unique Files associated with the Conversation through `message_files`.

### Response — `200`

```json
{
  "items": [
    {
      "id": "file-uuid",
      "original_filename": "Team-Notes.pdf",
      "mime_type": "application/pdf",
      "file_size_bytes": 120450,
      "processing_status": "READY"
    }
  ]
}
```

---

# 7. Files / Global Library

## `POST /files`

Uploads a File to Object Storage and processes it synchronously. Supported uploads are UTF-8
text and Markdown, text-layer PDFs, DOCX documents, and JPEG, PNG, or WebP images. Images are
described by the configured vision model before the description is chunked and embedded.

Content type:

```text
multipart/form-data
```

### Request

```text
file = Capstone-Handbook.pdf
```

There is no `project_id` because Files do not directly belong to Projects.

### Response — `201`

```json
{
  "id": "file-uuid",
  "original_filename": "Capstone-Handbook.pdf",
  "mime_type": "application/pdf",
  "file_size_bytes": 528944,
  "processing_status": "READY",
  "created_at": "2026-08-23T05:30:00Z"
}
```

---

## `GET /files`

Returns the current Supervisor's Global Library.

Supported query parameters:

```text
search
processing_status
page
page_size
```

Example:

```text
GET /files?search=handbook&page=1&page_size=20
```

### Response — `200`

```json
{
  "items": [
    {
      "id": "file-uuid",
      "original_filename": "Capstone-Handbook.pdf",
      "mime_type": "application/pdf",
      "file_size_bytes": 528944,
      "processing_status": "READY",
      "processing_error": null,
      "created_at": "2026-08-23T05:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

---

## `GET /files/{file_id}`

Returns File metadata.

### Response — `200`

```json
{
  "id": "file-uuid",
  "original_filename": "Capstone-Handbook.pdf",
  "mime_type": "application/pdf",
  "file_size_bytes": 528944,
  "processing_status": "READY",
  "processing_error": null,
  "created_at": "2026-08-23T05:30:00Z",
  "updated_at": "2026-08-23T05:30:10Z"
}
```

Internal storage fields do not need to be returned to React.

---

## `DELETE /files/{file_id}`

Deletes the File from Object Storage and removes its database data.

This removes:

```text
file
document_chunks
message_files relationships
```

Messages remain.

### Response — `204`

```text
No Content
```

---

## `GET /files/{file_id}/download`

Provides access to the original Object Storage object.

The backend validates File ownership and then uses:

```text
storage_base_url + storage_path
```

### Response

Typically:

```text
302 Found
```

redirecting to a temporary signed Object Storage URL.

---

# 8. Message File Association

## `POST /conversations/{conversation_id}/files`

Associates an existing Library File with a Conversation.

This is useful when Files are selected before a question is submitted.

### Request

```json
{
  "file_ids": [
    "file-1-uuid",
    "file-2-uuid"
  ]
}
```

### Response — `200`

```json
{
  "conversation_id": "conversation-uuid",
  "files": [
    {
      "id": "file-1-uuid",
      "original_filename": "Handbook.pdf"
    },
    {
      "id": "file-2-uuid",
      "original_filename": "Assessment-Guide.pdf"
    }
  ]
}
```

When a Message is later created, its own `message_files` records are created using the same `conversation_id`.

---

# 9. AI Chat

## `POST /conversations/{conversation_id}/messages`

Creates a Supervisor Message and prepares an Assistant response.

### Request

```json
{
  "content": "What should I do if one member repeatedly misses meetings?",
  "file_ids": [
    "file-uuid"
  ]
}
```

### Response — `201`

```json
{
  "user_message": {
    "id": "user-message-uuid",
    "role": "USER",
    "content": "What should I do if one member repeatedly misses meetings?",
    "status": "COMPLETED",
    "sequence_no": 1
  },
  "assistant_message": {
    "id": "assistant-message-uuid",
    "role": "ASSISTANT",
    "content": "",
    "status": "PENDING",
    "sequence_no": 2
  },
  "stream_url": "/api/v1/messages/assistant-message-uuid/stream"
}
```

For each supplied File, the backend creates:

```text
message_files:
conversation_id
message_id
file_id
```

---

## `GET /messages/{message_id}/stream`

Streams the Assistant response using SSE.

Response content type:

```text
text/event-stream
```

### Start Event

```text
event: start
data: {"message_id":"assistant-message-uuid"}
```

### Token Event

```text
event: token
data: {"delta":"Based on the uploaded document"}
```

### Complete Event

```text
event: complete
data: {"message_id":"assistant-message-uuid","status":"COMPLETED"}
```

### Error Event

```text
event: error
data: {"code":"AI_GENERATION_FAILED","message":"AI response generation failed."}
```

The generated Assistant Message is persisted in `messages`.

Retrieved RAG chunks are not persisted after generation because `message_sources` no longer exists.

---

## `POST /messages/{message_id}/retry`

Regenerates an Assistant response.

### Request

No body.

### Response — `200`

```json
{
  "message": {
    "id": "assistant-message-uuid",
    "role": "ASSISTANT",
    "content": "",
    "status": "PENDING"
  },
  "stream_url": "/api/v1/messages/assistant-message-uuid/stream"
}
```

The existing Assistant content is replaced by the new generation.

---

# 10. RAG Retrieval Behaviour

For a Project Conversation:

```text
Project
→ Conversations
→ message_files
→ Files
→ document_chunks
```

Only Files:

```text
owned by current Supervisor
AND
processing_status = READY
```

may be retrieved.

For an unprojected Conversation, retrieval is limited to Files associated with that Conversation.

---

# 11. Endpoint Summary

| Method | Endpoint                         | Purpose                        |
| ------ | -------------------------------- | ------------------------------ |
| POST   | `/auth/login`                    | Login                          |
| POST   | `/auth/logout`                   | Logout                         |
| GET    | `/account`                       | View account                   |
| PUT    | `/account/password`              | Change password                |
| GET    | `/faculties`                     | List Faculties                 |
| POST   | `/admin/supervisors`             | Create Supervisor              |
| GET    | `/admin/supervisors`             | List/search Supervisors        |
| GET    | `/admin/supervisors/{id}`        | View Supervisor                |
| PATCH  | `/admin/supervisors/{id}`        | Edit Supervisor                |
| PATCH  | `/admin/supervisors/{id}/status` | Activate/deactivate Supervisor |
| POST   | `/projects`                      | Create Project                 |
| GET    | `/projects`                      | List Projects                  |
| GET    | `/projects/{id}`                 | View Project                   |
| PATCH  | `/projects/{id}`                 | Update Project                 |
| DELETE | `/projects/{id}`                 | Delete Project                 |
| GET    | `/projects/{id}/files`           | Project Library                |
| POST   | `/conversations`                 | Create Conversation            |
| GET    | `/conversations`                 | List Conversations             |
| GET    | `/conversations/{id}`            | View Conversation              |
| PATCH  | `/conversations/{id}`            | Rename Conversation            |
| PATCH  | `/conversations/{id}/project`    | Move Conversation              |
| DELETE | `/conversations/{id}`            | Delete Conversation            |
| GET    | `/conversations/{id}/messages`   | Get Messages                   |
| GET    | `/conversations/{id}/files`      | Conversation Library           |
| POST   | `/conversations/{id}/files`      | Associate Library Files        |
| POST   | `/files`                         | Upload File                    |
| GET    | `/files`                         | Global Library                 |
| GET    | `/files/{id}`                    | View File metadata             |
| DELETE | `/files/{id}`                    | Delete File                    |
| GET    | `/files/{id}/download`           | Access original File           |
| POST   | `/conversations/{id}/messages`   | Ask AI Assistant               |
| GET    | `/messages/{id}/stream`          | Stream AI answer               |
| POST   | `/messages/{id}/retry`           | Regenerate AI answer           |

**Total: 33 endpoints.**
