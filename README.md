# Capstone Teaching Assistant

Capstone Teaching Assistant is a local AI-assisted workspace for university capstone
supervisors. It combines project and conversation management with document retrieval so
supervisors can ask questions against project material and receive source-backed answers.

## Features

- Administrator and supervisor account workflows
- Project instructions that guide assistant responses
- Conversation history, search, file associations, and source references
- Upload and indexing for TXT, Markdown, PDF, DOCX, JPEG, PNG, and WebP files
- AI-generated image descriptions that follow the normal chunking and embedding pipeline
- PostgreSQL and pgvector retrieval across conversation files
- Streaming assistant responses from local Ollama models
- RustFS-backed file storage

## Architecture

```text
Browser
  -> React + Vite frontend (:3000)
  -> FastAPI backend (:8000)
       -> PostgreSQL + pgvector (:5432)
       -> RustFS object storage (:9000)
       -> Ollama chat, vision, and embedding models (:11434)
```

The repository contains:

```text
capstone-teaching-assistant-rz2-app/  React frontend
capstone-teaching-assistant-rz2-be/   FastAPI backend, migrations, and Docker Compose
docs/                                 Project documentation
scripts/                              Cross-platform local runners
```

## One-Command Local Start

### Prerequisites

Install these system tools before running the project:

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [Node.js](https://nodejs.org/) with npm
- [Ollama](https://ollama.com/download)

Docker must be running. The startup script installs project dependencies and Ollama models,
but it does not install these system-level prerequisites.

### macOS or Linux

```bash
./scripts/run-mac-linux.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-windows.ps1
```

On the first run, the script:

1. Creates missing local environment files without overwriting existing configuration.
2. Synchronizes backend and frontend dependencies.
3. Starts PostgreSQL and RustFS and initializes the file bucket.
4. Applies database migrations and seeds the local administrator account.
5. Starts Ollama when necessary and downloads any missing chat, vision, and embedding models.
6. Starts FastAPI and Vite, waits for both to become ready, and opens the web app.

Model downloads can make the first run take several minutes. Later runs reuse installed
dependencies, models, containers, and persistent Docker volumes.

Press `Ctrl+C` to stop the runner. It stops the frontend, backend, Ollama server, PostgreSQL,
and RustFS only when those processes or services were started by that run. Docker volumes are
preserved. Services that were already running before the command are left running.

## Local URLs

| Service | URL |
| --- | --- |
| Web app | <http://localhost:3000> |
| Backend API | <http://localhost:8000> |
| Swagger documentation | <http://localhost:8000/docs> |
| OpenAPI schema | <http://localhost:8000/openapi.json> |
| RustFS S3 endpoint | <http://localhost:9000> |
| Ollama API | <http://localhost:11434> |

With the example backend environment, the initial administrator credentials are:

```text
username: admin
password: AdminPassword123!
```

Use the administrator account to create a supervisor account for the teaching-assistant chat
workflow. If an existing database or custom `.env` is used, use the credentials configured for
that environment instead.

## Configuration and Development

The runners copy the following files only when their local counterparts do not exist:

- `capstone-teaching-assistant-rz2-be/.env.example` -> `.env`
- `capstone-teaching-assistant-rz2-app/.env.example` -> `.env.local`

For manual setup, backend configuration, migrations, API commands, and verification, see the
[backend README](capstone-teaching-assistant-rz2-be/README.md). For frontend-only commands, see
the [frontend README](capstone-teaching-assistant-rz2-app/README.md).

Common verification commands are:

```bash
cd capstone-teaching-assistant-rz2-be
uv run pytest
uv run ruff format --check .
uv run ruff check .
uvx ty check
```

```bash
cd capstone-teaching-assistant-rz2-app
npm test
npm run lint
npm run build
```
