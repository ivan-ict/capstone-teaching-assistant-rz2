## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and set `VITE_API_BASE_URL` plus optional real demo credentials
3. Run the app:
   `npm run dev`


Admin workflow: create a semester, manage its files and supervisors, then create supervisor accounts
with a required semester assignment. Supervisor chat uses all ready documents in that semester
and personal same-semester conversation history. Archived semesters are read-only.

This frontend requires the semester backend migration. See the
[backend upgrade procedure](../capstone-teaching-assistant-rz2-be/README.md#semester-upgrade)
before starting against an existing development database.
