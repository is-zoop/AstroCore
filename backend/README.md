# AstroCore FastAPI Backend

## Run

```powershell
cd E:\AstroCore\backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The frontend expects the API at `http://localhost:8000` by default. Override with `VITE_API_BASE_URL` if needed.

## Default Accounts

- `admin / admin`: `system_admin`
- `demo / demo`: `viewer`

## Storage

- SQLite database: `backend/data/astrocore.db`
- Dashboard HTML: `backend/storage/dashboard_files/{dashboard_id}/index.html`
- Logo and avatar uploads: `backend/storage/uploads`
