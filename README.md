# GuideAI

A minimal ChatGPT/Claude-style interface where the AI **guides users to solutions** instead of solving problems directly.

---

## Project Structure

```
guideai/
├── frontend/
│   └── index.html          # Complete frontend — open directly in browser
└── backend/
    ├── src/
    │   ├── index.js         # Hono server (main entry)
    │   └── db/
    │       ├── schema.js    # Drizzle ORM schema
    │       ├── client.js    # DB connection
    │       └── migrate.js   # Creates tables
    ├── package.json
    └── .env.example
```

---

## Setup

### 1. Database

Create a MariaDB database:

```sql
CREATE DATABASE guideai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend

```bash
cd backend

# Copy and fill in your env
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY, DB_PASSWORD etc.

# Install deps
bun install

# Create tables
bun run db:push

# Start dev server
bun run dev
```

Server starts at **http://localhost:3000**

### 3. Frontend

Just open `frontend/index.html` directly in your browser — no build step needed.

Or serve it with any static server:

```bash
cd frontend
bunx serve .
# or
python3 -m http.server 8080
```

---

## How It Works

**The "guide, don't solve" logic lives entirely in the backend system prompt** (`src/index.js` → `SYSTEM_PROMPT`).

- If the user is **solving a problem** → AI asks guiding questions, explains concepts, hints at the right approach
- If the user is **chatting normally** (greetings, general knowledge, opinions) → AI responds naturally

The frontend is a pure HTML/CSS/JS file with:
- Sidebar: model selector + chat history
- Main area: messages + chat input
- Model selector supports: Claude Sonnet 4, Opus 4, Haiku 4.5

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Send a message, get AI reply |
| GET | `/sessions` | List all chat sessions |
| GET | `/sessions/:id/messages` | Load messages for a session |
| DELETE | `/sessions/:id` | Delete a session |

### POST /chat body
```json
{
  "message": "Help me fix my React error",
  "sessionId": "optional-existing-session-id",
  "model": "claude-sonnet-4-20250514"
}
```

---

## Customising the AI behaviour

Edit `SYSTEM_PROMPT` in `backend/src/index.js` to change how the AI guides users.