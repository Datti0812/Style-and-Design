# Style Intel — Fashion Garment Classification Platform

An internal POC for fashion designers to upload garment images and get AI-powered classification and inspiration insights using Anthropic Claude.

---

## Features

- Upload garment images via drag & drop
- Automatic AI classification using Claude (garment type, style, material, color, pattern, season, occasion, and more)
- Masonry image grid with search and multi-dimensional filtering
- Detail view with full AI description and structured attributes
- Custom annotation support per garment
- Delete garments from the platform

---

## Project Structure

```
Style-Design/
├── index.html          # Main UI
├── styles.css          # Styles (masonry grid, modals, filters)
├── app.js              # Frontend logic (upload, filters, polling)
└── backend/
    ├── main.py         # FastAPI app entry point
    ├── requirements.txt
    ├── .env            # API keys and config (not committed)
    ├── .env.example    # Template for .env
    ├── models/
    │   ├── database.py # SQLAlchemy async engine + session
    │   └── garment.py  # Garment ORM model
    ├── routers/
    │   └── garments.py # All garment API routes
    └── services/
        └── classifier.py  # Claude multimodal classification logic
```

---

## Setup

### 1. Clone and install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
UPLOAD_DIR=uploads
DATABASE_URL=sqlite+aiosqlite:///./styleintel.db
```

Get your API key from [console.anthropic.com](https://console.anthropic.com). Ensure your account has credits.

### 3. Start the backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 4. Open the app

Visit [http://localhost:8000](http://localhost:8000) in your browser.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/garments/upload` | Upload one or more garment images |
| `GET` | `/api/garments` | List garments (supports filters: `q`, `garment_type`, `style`, `season`, `occasion`, `color_palette`, `location_context`) |
| `GET` | `/api/garments/filters` | Get distinct filter values |
| `GET` | `/api/garments/{id}` | Get a single garment |
| `GET` | `/api/garments/{id}/image` | Serve the garment image |
| `PATCH` | `/api/garments/{id}/annotation` | Update custom annotation |
| `DELETE` | `/api/garments/{id}` | Delete garment from DB and disk |
| `GET` | `/health` | Health check |

---

## How Classification Works

1. User uploads image → saved to `backend/uploads/` with a UUID filename
2. DB row created with `is_classified=false`, card shown immediately in the grid
3. Background task sends base64-encoded image to `claude-sonnet-4-6`
4. Claude returns a JSON with a description paragraph + 10 structured attributes
5. DB row updated with classification results, `is_classified=true`
6. Frontend polls `GET /api/garments/{id}` every 4 seconds and refreshes the card automatically

---

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS, Google Fonts (Inter + Playfair Display)
- **Backend**: FastAPI, SQLAlchemy (async), SQLite via aiosqlite
- **AI**: Anthropic Claude (`claude-sonnet-4-6`) multimodal API
- **Image storage**: Local filesystem (`backend/uploads/`)
