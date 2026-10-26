# InternTrack AI — Full Source Code

This project package separates the existing colourful white-theme dashboard into HTML, CSS, and browser JavaScript, and adds a Node.js/Express REST API with SQLite storage plus an optional Python advisory service.

## Project structure

```text
InternTrack_AI_Full_Source/
├── public/
│   ├── index.html       # Main website
│   ├── css/style.css    # Full styling and responsive layout
│   └── js/app.js        # Frontend interactions
├── server.js            # Node.js + Express API
├── ai_service.py        # Optional Python advisory API (rule-based)
├── package.json
├── requirements.txt
├── data/                # SQLite database is created here
└── README.md
```

## 1. Requirements

- Node.js 18 or newer
- Python 3.10 or newer (only if you want to run the Python advisory API)
- Internet connection for the Google Fonts and SheetJS CDN used by the frontend

## 2. Run the website and Node.js API

Open a terminal in this project folder and run:

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

The API includes:
- `GET /api/health`
- `GET /api/students?q=...&status=...`
- `GET /api/students/:id`
- `POST /api/students`
- `PUT /api/students/:id`
- `DELETE /api/students/:id`
- `GET /api/reviews`
- `POST /api/reviews`
- `PATCH /api/reviews/:id`
- `GET /api/activity`

The SQLite database is automatically created at `data/interntrack.db` and seeded with a few demo records.

## 3. Run the Python advisory service (optional)

In a second terminal:

```bash
python -m venv .venv
```

Windows:
```powershell
.venv\Scripts\Activate.ps1
```

macOS/Linux:
```bash
source .venv/bin/activate
```

Then:
```bash
pip install -r requirements.txt
python ai_service.py
```

Test it at `http://127.0.0.1:5001/health`. Submit a JSON POST to `/advisory`:

```json
{
  "stage": "Mid-Internship Review",
  "summary": "I implemented a form, tested the workflow, and learned to validate user input. Next I will improve error handling."
}
```

This Python service generates a **rule-based advisory checklist**, not an actual LLM evaluation or automated grade. A human reviewer must make the final decision.

## Important project note

The current frontend preserves the working demo interface and its browser-local demo behaviour. The REST API and Python service are included as real backend source code, but the current dashboard UI has not been fully wired to synchronize every existing screen with those APIs. The API can be tested directly, and integration between all frontend forms and backend endpoints is the next development step.

This is a learning/demo project. Before real deployment, add authentication, server-enforced roles, input validation, CSRF/rate-limit protections as appropriate, environment-based secrets, backups, and production deployment configuration.
