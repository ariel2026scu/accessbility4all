# PlainSpeak — Frontend

React + Vite frontend for the PlainSpeak accessibility tool. Translates complex legal language and Old English into plain language, with text-to-speech audio.

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Opens at `http://localhost:5173`

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api` | Backend API base URL |
| `VITE_DEV_MODE` | `false` | Set `true` to use mock data without calling the backend |

`.env.local` is gitignored — each developer keeps their own settings.

---

## Dev Mode (Frontend Developers)

If you are working on the **frontend only** and don't want to run the backend or Ollama locally, enable Dev Mode:

**1. In your `.env.local`, set:**
```env
VITE_DEV_MODE=true
```

**2. Run the frontend normally:**
```bash
npm run dev
```

**What changes in Dev Mode:**
- Translation uses local mock rules (simple word replacements) — no API calls made
- Audio uses the browser's built-in speech synthesis instead of backend TTS
- A yellow banner at the top of the app reminds you that Dev Mode is on
- The footer shows `"Dev Mode: using mock translation"`

**When to turn Dev Mode off:**
Set `VITE_DEV_MODE=false` (or remove the line) once the backend is running and you want to test the real LLM translation and audio pipeline.

---

## Connecting to the Backend

With `VITE_DEV_MODE=false` (default), the frontend calls:

```
POST /api/llm_output
Body: { "text": "..." }
Response: { "text": "...", "audio": "<base64 wav>", "chunks_processed": 1, "status": "success" }
```

The backend must be running at `VITE_API_URL` (default: `http://localhost:8000`).

**To run the backend:**
```bash
cd ../backend
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload
```

**Error handling:** If the backend is unreachable or returns an error, a red error message appears below the Translate button with the server's error detail.

---

## Project Structure

```
frontend/
├── src/
│   ├── App.jsx        # Main component — all app logic lives here
│   ├── App.css        # Styles
│   ├── main.jsx       # React entry point
│   └── index.css      # Base / reset styles
├── .env.example       # Environment variable template
├── .env.local         # Your local settings (gitignored)
├── index.html
├── vite.config.js
└── package.json
```

---

## Features

- **Translate** — sends text to backend LLM (or mock in Dev Mode)
- **Read Aloud** — plays backend WAV audio; falls back to browser speech synthesis in Dev Mode
- **Copy** — copies translated text to clipboard
- **Reading Mode** — high-contrast, large-font accessibility layout
- **Hard Word Detection** — highlights difficult terms found in the input
- **Example Texts** — pre-filled legal and Old English examples

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## Notes for Frontend Developers

- All API interaction is in `handleTranslate()` and `handleReadAloud()` in `App.jsx`
- The `DEV_MODE` constant (read from `VITE_DEV_MODE`) guards every API call — if `true`, the real fetch is skipped
- `fakeTranslate()` in `App.jsx` is the mock used in Dev Mode — extend it if you need richer mock output
- Audio from the backend is base64-encoded WAV; it is decoded and played via a `Blob` URL
- CORS is configured on the backend to allow `http://localhost:5173` by default
