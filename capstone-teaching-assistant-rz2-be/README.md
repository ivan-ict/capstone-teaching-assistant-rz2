# Capstone Teaching Assistant Backend

Backend API for the Capstone Teaching Assistant project.

The service is a FastAPI application using:

- Python 3.14+
- uv for dependency and command management
- PostgreSQL with pgvector
- RustFS as S3-compatible object storage
- LangChain with Ollama/Qwen for chat and embeddings
- Alembic for database migrations
- pytest, Ruff, ty, and pre-commit for verification

## Project Structure

```text
app/
  main.py
  common/
    ai.py
    auth.py
    config.py
    database.py
    db_models.py
    errors.py
    object_storage.py
    text_processing.py
  modules/
    account/
    admin/supervisors/
    auth/
    conversations/
    faculties/
    files/
    messages/
    semesters/
migrations/
tests/
  integration/
  unit/
tools/
  chat_demo.py
```

Domain modules follow the same shape where applicable:

- `{domain}_router.py` for API endpoints and Swagger/OpenAPI metadata
- `{domain}_model.py` for Pydantic DTOs
- `{domain}_service.py` for business logic
- `{domain}_repository.py` for database and storage persistence

The normal call flow is:

```text
Router -> Service -> Repository
Service -> Service
```

## Local Setup

### Prerequisites

Install these system tools before running the project:

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [Node.js](https://nodejs.org/) with npm
- [Ollama](https://ollama.com/download)

Docker must be running. The startup script installs project dependencies and Ollama models,
but it does not install these system-level prerequisites.

Install uv if needed:
#### For MacOS:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```
#### For Windows (PowerShell)
```bash
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

From this backend folder:

```bash
uv sync
cp .env.example .env
```

Start PostgreSQL and RustFS:

```bash
docker compose up -d
```

Run database migrations:

```bash
uv run alembic upgrade head
```

Seed a local admin account for development:

```bash
uv run python tools/seed_local_admin.py
```

Start Ollama and pull the local MVP models:

```bash
ollama pull qwen3.5:4b
ollama pull qwen3-vl:2b
ollama pull qwen3-embedding:0.6b
```

Run the API:

```bash
uv run fastapi dev app/main.py
```

Useful local URLs:

- API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- PostgreSQL: `localhost:5432`
- RustFS S3 endpoint: `http://localhost:9000`

## Configuration

Local defaults are provided in `.env.example`.

Important settings:

```text
DATABASE_URL=postgresql+psycopg://capstone:capstone@localhost:5432/capstone
RUSTFS_ENDPOINT_URL=http://localhost:9000
RUSTFS_BUCKET_NAME=capstone-files
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen3.5:4b
OLLAMA_CHAT_TEMPERATURE=0.2
OLLAMA_VISION_MODEL=qwen3-vl:2b
OLLAMA_EMBEDDING_MODEL=qwen3-embedding:0.6b
EMBEDDING_DIMENSION=1024
RAG_TOP_K=5
CHUNK_SIZE=1200
CHUNK_OVERLAP=200
MAX_UPLOAD_BYTES=10485760
CORS_ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:8501"]
```

Optional Ollama chat controls are documented in `.env.example`. In particular,
`OLLAMA_CHAT_NUM_PREDICT` limits output tokens, `OLLAMA_CHAT_REASONING` controls
model reasoning, and `OLLAMA_CHAT_KEEP_ALIVE` reduces repeated model load time.
Context, thread, and GPU overrides are also available but should be tuned for the
host rather than enabled as portable defaults.

The migrations seed reference Faculty data. The local admin seed script creates:

```text
username=admin
password=AdminPassword123!
```

Authenticated API requests must use the bearer token returned by `POST /api/v1/auth/login`.
`POST /api/v1/auth/logout` revokes the current token.

### Email (Gmail SMTP)

The backend emails credentials in three cases:

- When an admin creates a supervisor (`POST /api/v1/admin/supervisors`), a password is generated
  and emailed to the supervisor. The admin no longer chooses it.
- When an admin resets a supervisor's password (`POST /api/v1/admin/supervisors/{id}/password-reset`),
  a new password is generated and emailed.
- When anyone submits `POST /api/v1/auth/forgot-password` with a supervisor's username or email,
  that supervisor's password is replaced immediately and the new one is emailed. This endpoint
  needs no authentication. It always returns the same `202` response, and it is rate limited per
  account (`PASSWORD_RESET_COOLDOWN_SECONDS`) and per IP (`PASSWORD_RESET_IP_LIMIT` within
  `PASSWORD_RESET_IP_WINDOW_SECONDS`). Admin accounts have no email address and are not eligible.

For admin create and reset, the email is sent before the change is committed. If delivery fails,
the API returns `502 EMAIL_DELIVERY_FAILED` and nothing changes.

By default `EMAIL_BACKEND=console`, which writes emails to the API log so that local development
works without credentials. To send real mail through Gmail:

1. Turn on 2-Step Verification for the sending Google account.
2. Create an app password at <https://myaccount.google.com/apppasswords>.
3. Set the following in `.env`. Paste the 16-character app password without spaces, and keep
   `SMTP_FROM_EMAIL` the same as the Gmail account, or Gmail will rewrite it.

```text
EMAIL_BACKEND=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your.address@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
SMTP_FROM_EMAIL=your.address@gmail.com
FRONTEND_LOGIN_URL=http://localhost:3000
```

Signed-in users can change their own password with `PUT /api/v1/account/password`.

## Chat MVP

Implemented MVP workflow:

- Conversation CRUD
- Admin semester CRUD, archive, and atomic supervisor assignments
- Admin-only semester file upload and soft deletion
- Text, Markdown, PDF, DOCX, JPEG, PNG, and WebP upload to RustFS
- Extracted document text and generated image descriptions stored as embedded chunks
- Message creation with user and assistant message pair
- SSE assistant response streaming
- Retry assistant generation
- pgvector retrieval over all ready semester documents and the supervisor’s personal same-semester messages

Text and Markdown uploads must use UTF-8. PDFs must contain an extractable text layer;
scanned PDFs are not processed with OCR. Images are described by `OLLAMA_VISION_MODEL`, and
the generated description follows the same chunking and embedding path as document text.

## Streamlit Demo

Run the local chat demo:

```bash
uv run streamlit run tools/chat_demo.py
```

The demo lets supervisors create/select conversations and stream answers from their assigned semester.
Archived semesters are read-only. Use Admin to create a semester, upload documents, and create
a supervisor with the required `semester_id` before signing into the demo.

## Tests And Checks

Run tests:

```bash
uv run pytest
```

Run formatting and lint checks:

```bash
uv run ruff format --check .
uv run ruff check .
```

Run type checks:

```bash
uvx ty check
```

Validate Alembic SQL generation:

```bash
uv run alembic upgrade head --sql
```

Run all pre-commit hooks:

```bash
uv run pre-commit run --all-files
```

Install hooks locally:

```bash
uv run pre-commit install
```

## Development Workflow

Use test-driven development for new features:

1. Read the relevant docs and existing module patterns.
2. Clarify the expected API/data contract before implementation.
3. Sketch the function/service shape without filling in the implementation.
4. Add unit tests for service behavior and integration tests for request workflows.
5. Implement the feature without weakening the tests.
6. Run Ruff format, Ruff lint, ty, pytest, and relevant Alembic checks.

Keep tests domain-organized:

```text
tests/
  unit/{domain}/
  integration/{domain}/
```

Unit tests should focus on service behavior. Integration tests should exercise real FastAPI request/response workflows with test doubles only where external services would otherwise be required.


## Semester upgrade

Existing development data is disposable for this change. **Stop the backend and demo before
resetting.** The reset deletes supervisor accounts, projects, conversations, messages, files,
and their stored objects. It preserves admin accounts and faculties. Do not run it against
any database whose supervisor/workspace data you need to retain.

From this directory, with `APP_ENVIRONMENT=development` and the intended `DATABASE_URL`:

```bash
uv run python tools/reset_development_workspace.py --confirm-reset
uv run alembic upgrade head
```

The reset reports removal counts and fails loudly on object-storage errors. Object deletion
cannot roll back: on failure the database records remain, but some objects may already have
been removed. Resolve the reported storage issue and rerun before migrating.
The migration itself refuses populated legacy tables. Downgrading ownership to projects is
unsupported; restore a pre-upgrade backup if necessary. Frontend and backend must be upgraded
together. The normal startup script does not run the reset.

After upgrading, create an active semester in Admin, upload its documents, and recreate each
supervisor with an assigned semester. Dates are informational. Archive a semester to disable
all conversation mutations while retaining history and cited-file downloads. Moving a supervisor
shows only their own history in the destination semester; returning restores the original history.

Admin semester routes are under `/api/v1/admin/semesters`: list/create, get/edit/archive,
`/{id}/files` for upload/list, `/{id}/files/{file_id}` for soft deletion,
`/{id}/supervisors` for listing and atomic assignment via `supervisor_ids`, and
`/{id}/supervisor-candidates` for eligible active accounts outside the destination.
Supervisor creation requires `semester_id`; account and supervisor responses expose semester details.
Conversation creation accepts `{}` and messages accept `{ "content": "..." }`.
Project routes and attachment selection/association routes are removed.

Soft-deleted files retain their objects/chunks and saved citation excerpts, but are excluded
from future retrieval and downloads. Supervisors may download only cited, non-deleted files
in their current semester through authenticated `/api/v1/files/{id}/download` requests.
