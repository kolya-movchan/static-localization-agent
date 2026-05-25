# Static Localization Agent

AI-powered image localization tool. Give it a Google Drive file or folder of ad creatives, pick your target languages, and Gemini rewrites all text in the images while preserving layout, fonts, and colors. Track every job and its results in a clean web dashboard.

## How it works

1. Point it at a Google Drive file or folder
2. Choose target locales (EN, UA, DE, FR, ES, PL, IT, RU, or any custom code)
3. The worker processes each image × language pair via Gemini (with automatic fallback model)
4. Localized images are saved into `/{LOCALE}/` subfolders inside the source folder
5. The dashboard shows live progress and direct Drive links to every output file

## Quick start

### 1. Clone & configure

```bash
git clone https://github.com/your-org/static-localization-agent
cd static-localization-agent
cp .env.example .env
```

Edit `.env` and fill in:
- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey)
- `GOOGLE_SERVICE_ACCOUNT_PATH` — path to your service account JSON (see below)

### 2. Google Drive setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → IAM → Service Accounts
2. Create a service account and download the JSON key
3. Enable the **Google Drive API** for your project
4. Place the key at the path set in `GOOGLE_SERVICE_ACCOUNT_PATH`
5. Share your Drive folder with the service account email (found in the JSON under `client_email`) — give it **Editor** access

### 3. Run with Docker (recommended)

```bash
docker-compose up
```

Open [http://localhost:3001](http://localhost:3001)

### 4. Run locally (dev)

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Programmatic API

### Create a job

```bash
curl -X POST http://localhost:3001/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "input_type": "folder",
    "input_url": "https://drive.google.com/drive/folders/YOUR_FOLDER_ID",
    "languages": ["UA", "DE"],
    "comments": "Keep brand name in English"
  }'
```

### List jobs

```bash
curl http://localhost:3001/api/jobs
```

### Get job details + items

```bash
curl http://localhost:3001/api/jobs/{job_id}
```

### Live updates (SSE)

```javascript
const es = new EventSource('http://localhost:3001/api/jobs/{job_id}/stream');
es.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required.** Gemini API key |
| `GOOGLE_SERVICE_ACCOUNT_PATH` | — | **Required.** Path to service account JSON |
| `GEMINI_PRIMARY_MODEL` | `gemini-2.0-flash-preview-image-generation` | Primary image editing model |
| `GEMINI_FALLBACK_MODEL` | `gemini-2.0-flash-exp` | Fallback if primary fails |
| `GEMINI_AGENT_MODEL` | `gemini-2.0-flash` | Model for the AI chat agent |
| `PORT` | `3001` | Server port |
| `RATE_LIMIT_MS` | `5000` | Delay between Gemini calls (ms) |
| `RATE_LIMIT_MS` | `5000` | Delay between Gemini API calls |
| `DB_PATH` | `./data/jobs.db` | SQLite database location |

## Supported locales

Any 2–5 character code is accepted. Common ones with built-in prompt hints: `EN`, `UA`, `DE`, `FR`, `ES`, `PL`, `IT`, `RU`.

## Output structure

Given a source folder `Creatives/` with `banner.png`, after running with `["UA", "DE"]`:

```
Creatives/
├── banner.png          ← original untouched
├── UA/
│   └── banner.png      ← Ukrainian version
└── DE/
    └── banner.png      ← German version
```
