from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = BASE_DIR / "storage"
DASHBOARD_FILES_DIR = STORAGE_DIR / "dashboard_files"
UPLOADS_DIR = STORAGE_DIR / "uploads"
TABLE_UPLOADS_DIR = STORAGE_DIR / "table_uploads"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DASHBOARD_FILES_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
TABLE_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("ASTROCORE_DATABASE_URL", f"sqlite:///{DATA_DIR / 'astrocore.db'}")
JWT_SECRET = os.getenv("ASTROCORE_JWT_SECRET", "change-this-secret-in-production")
JWT_EXPIRE_MINUTES = int(os.getenv("ASTROCORE_JWT_EXPIRE_MINUTES", "60"))
APP_ORIGIN = os.getenv("ASTROCORE_APP_ORIGIN", "http://localhost:3000")
