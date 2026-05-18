from pathlib import Path
from urllib.parse import quote_plus
from shutil import rmtree
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine as create_sqlalchemy_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .config import APP_ORIGIN, DASHBOARD_FILES_DIR, UPLOADS_DIR
from .database import Base, SessionLocal, engine, get_db
from .deps import current_user, require_dataset_admin, require_system_admin
from .models import Dashboard, Dataset, Datasource, SystemSettings, User
from .schemas import (
    DashboardPayload,
    DatasetPayload,
    DatasourcePayload,
    LoginRequest,
    LoginResponse,
    PasswordUpdate,
    PreviewResponse,
    SystemSettingsPayload,
    UserCreate,
    UserOut,
    UserUpdate,
)
from .security import create_access_token, decrypt_secret, encrypt_secret, hash_password, is_current_encrypted_secret, verify_password


app = FastAPI(title="AstroCore API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[APP_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/dashboard-files", StaticFiles(directory=str(DASHBOARD_FILES_DIR)), name="dashboard-files")


def seed_database() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            db.add(
                User(
                    username="admin",
                    email="admin@astrocore.local",
                    password_hash=hash_password("admin"),
                    role="system_admin",
                    status="active",
                )
            )
        elif not admin.password_hash.startswith("pbkdf2_sha256$"):
            admin.password_hash = hash_password("admin")
            admin.role = "system_admin"
            admin.status = "active"
        demo = db.query(User).filter(User.username == "demo").first()
        if not demo:
            db.add(
                User(
                    username="demo",
                    email="demo@astrocore.local",
                    password_hash=hash_password("demo"),
                    role="viewer",
                    status="active",
                )
            )
        elif not demo.password_hash.startswith("pbkdf2_sha256$"):
            demo.password_hash = hash_password("demo")
            demo.role = "viewer"
            demo.status = "active"
        if not db.query(SystemSettings).first():
            db.add(SystemSettings(system_name="AstroCore", system_icon="Zap"))
        for source in db.query(Datasource).all():
            if source.password_encrypted and not is_current_encrypted_secret(source.password_encrypted):
                source.password_encrypted = encrypt_secret(decrypt_secret(source.password_encrypted))
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:
    seed_database()


def serialize_user(user: User) -> dict:
    return UserOut.model_validate(user).model_dump()


def serialize_dashboard(dashboard: Dashboard) -> dict:
    return {
        "id": dashboard.id,
        "name": dashboard.name,
        "category": dashboard.category,
        "icon": dashboard.icon,
        "dataset_id": dashboard.dataset_id,
        "dataset": dashboard.dataset.name if dashboard.dataset else "",
        "status": dashboard.status,
        "owner": dashboard.owner.username if dashboard.owner else "",
        "owner_id": dashboard.owner_id,
        "updated_at": dashboard.updated_at.isoformat(sep=" ", timespec="minutes"),
        "created_at": dashboard.created_at.isoformat(sep=" ", timespec="minutes"),
        "file_url": dashboard.file_url,
    }


def serialize_dataset(dataset: Dataset) -> dict:
    return {
        "id": dataset.id,
        "name": dataset.name,
        "datasource_id": dataset.datasource_id,
        "owner": dataset.owner.username if dataset.owner else "",
        "owner_id": dataset.owner_id,
        "sql": dataset.sql,
        "created_at": dataset.created_at.isoformat(sep=" ", timespec="minutes"),
        "updated_at": dataset.updated_at.isoformat(sep=" ", timespec="minutes"),
    }


def serialize_datasource(source: Datasource) -> dict:
    return {
        "id": source.id,
        "name": source.name,
        "type": source.type,
        "host": source.host,
        "port": source.port,
        "username": source.username,
        "password_encrypted": source.password_encrypted,
        "password_preview": source.password_encrypted or "",
        "database": source.database,
        "status": source.status,
        "created_at": source.created_at.isoformat(sep=" ", timespec="minutes"),
        "updated_at": source.updated_at.isoformat(sep=" ", timespec="minutes"),
    }


def build_datasource_url(source: Datasource) -> str:
    password = quote_plus(decrypt_secret(source.password_encrypted) or "")
    username = quote_plus(source.username or "")
    host = source.host
    port = source.port
    database = quote_plus(source.database or "")
    db_path = f"/{database}" if database else ""

    if source.type == "mysql":
        return f"mysql+pymysql://{username}:{password}@{host}:{port or 3306}{db_path}"
    if source.type == "postgresql":
        return f"postgresql+psycopg2://{username}:{password}@{host}:{port or 5432}{db_path}"
    if source.type == "sqlserver":
        driver = quote_plus("ODBC Driver 17 for SQL Server")
        return f"mssql+pyodbc://{username}:{password}@{host}:{port or 1433}{db_path}?driver={driver}"
    raise HTTPException(status_code=400, detail="Unsupported datasource type")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="输入的账号或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号未激活")
    token, expires_in = create_access_token(str(user.id), user.role)
    return LoginResponse(access_token=token, expires_in=expires_in, user=user)


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)) -> dict:
    return serialize_user(user)


@app.post("/api/auth/logout")
def logout() -> dict:
    return {"ok": True}


@app.get("/api/dashboards")
def list_dashboards(
    keyword: str = "",
    status: str = "",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Dashboard)
    if user.role == "viewer":
        query = query.filter(Dashboard.status == "published")
    elif status:
        query = query.filter(Dashboard.status == status)
    if keyword:
        query = query.filter(Dashboard.name.contains(keyword))
    return [serialize_dashboard(item) for item in query.order_by(Dashboard.updated_at.desc()).all()]


@app.post("/api/dashboards")
def create_dashboard(
    payload: DashboardPayload,
    user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = Dashboard(**payload.model_dump(), owner_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_dashboard(item)


@app.put("/api/dashboards/{dashboard_id}")
def update_dashboard(
    dashboard_id: int,
    payload: DashboardPayload,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dashboard, dashboard_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return serialize_dashboard(item)


@app.delete("/api/dashboards/{dashboard_id}")
def delete_dashboard(
    dashboard_id: int,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dashboard, dashboard_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    folder = DASHBOARD_FILES_DIR / str(dashboard_id)
    if folder.exists():
        rmtree(folder)
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.post("/api/dashboards/{dashboard_id}/file")
async def upload_dashboard_file(
    dashboard_id: int,
    file: UploadFile = File(...),
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dashboard, dashboard_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".html", ".htm"}:
        raise HTTPException(status_code=400, detail="Only HTML dashboard files are allowed")
    folder = DASHBOARD_FILES_DIR / str(dashboard_id)
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / "index.html"
    target.write_bytes(await file.read())
    item.file_path = str(target)
    item.file_url = f"/dashboard-files/{dashboard_id}/index.html"
    db.commit()
    db.refresh(item)
    return serialize_dashboard(item)


@app.get("/api/dashboards/{dashboard_id}/view")
def view_dashboard(
    dashboard_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dashboard, dashboard_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if user.role == "viewer" and item.status != "published":
        raise HTTPException(status_code=403, detail="Permission denied")
    data = serialize_dashboard(item)
    data["iframe_url"] = item.file_url
    return data


@app.get("/api/search/dashboards")
def search_dashboards(
    keyword: str = "",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Dashboard).filter(Dashboard.status == "published")
    if keyword:
        query = query.filter(Dashboard.name.contains(keyword))
    return [serialize_dashboard(item) for item in query.limit(20).all()]


@app.get("/api/datasets")
def list_datasets(
    keyword: str = "",
    _: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Dataset)
    if keyword:
        query = query.filter(Dataset.name.contains(keyword))
    return [serialize_dataset(item) for item in query.order_by(Dataset.updated_at.desc()).all()]


@app.post("/api/datasets")
def create_dataset(
    payload: DatasetPayload,
    user: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = Dataset(**payload.model_dump(), owner_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_dataset(item)


@app.put("/api/datasets/{dataset_id}")
def update_dataset(
    dataset_id: int,
    payload: DatasetPayload,
    _: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dataset, dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dataset not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return serialize_dataset(item)


@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(
    dataset_id: int,
    _: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dataset, dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dataset not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.post("/api/datasets/{dataset_id}/preview", response_model=PreviewResponse)
def preview_dataset(
    dataset_id: int,
    _: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> PreviewResponse:
    item = db.get(Dataset, dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dataset not found")
    sql = item.sql.strip().rstrip(";")
    if not sql.lower().startswith("select"):
        raise HTTPException(status_code=400, detail="Only SELECT statements can be previewed")
    if not item.datasource:
        raise HTTPException(status_code=400, detail="请先为该数据集绑定数据源")

    preview_engine = None
    try:
        preview_engine = create_sqlalchemy_engine(
            build_datasource_url(item.datasource),
            pool_pre_ping=True,
            connect_args={"connect_timeout": 5} if item.datasource.type == "mysql" else {},
        )
        with preview_engine.connect() as connection:
            result = connection.execute(text(f"SELECT * FROM ({sql}) AS preview_source LIMIT 100"))
            rows = [dict(row._mapping) for row in result]
        columns = list(rows[0].keys()) if rows else []
        return PreviewResponse(columns=columns, rows=rows, message=None if rows else "SQL 执行成功，但没有返回数据")
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=400, detail=f"数据预览失败：{exc}") from exc
    finally:
        if preview_engine:
            preview_engine.dispose()


@app.get("/api/datasources")
def list_datasources(
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [serialize_datasource(item) for item in db.query(Datasource).order_by(Datasource.updated_at.desc()).all()]


@app.post("/api/datasources")
def create_datasource(
    payload: DatasourcePayload,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    data = payload.model_dump()
    password = data.pop("password")
    item = Datasource(**data, password_encrypted=encrypt_secret(password))
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_datasource(item)


@app.put("/api/datasources/{source_id}")
def update_datasource(
    source_id: int,
    payload: DatasourcePayload,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Datasource, source_id)
    if not item:
        raise HTTPException(status_code=404, detail="Datasource not found")
    data = payload.model_dump()
    password = data.pop("password")
    for key, value in data.items():
        setattr(item, key, value)
    if password:
        item.password_encrypted = encrypt_secret(password)
    db.commit()
    db.refresh(item)
    return serialize_datasource(item)


@app.delete("/api/datasources/{source_id}")
def delete_datasource(
    source_id: int,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Datasource, source_id)
    if not item:
        raise HTTPException(status_code=404, detail="Datasource not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.post("/api/datasources/{source_id}/test")
def test_datasource(
    source_id: int,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Datasource, source_id)
    if not item:
        raise HTTPException(status_code=404, detail="Datasource not found")
    test_message = "连接成功"
    try:
        test_engine = create_sqlalchemy_engine(build_datasource_url(item), pool_pre_ping=True, connect_args={"connect_timeout": 5} if item.type == "mysql" else {})
        with test_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        test_engine.dispose()
        item.status = "online"
    except Exception as exc:
        item.status = "failed"
        raw_message = str(exc)
        if "pymysql" in raw_message.lower():
            test_message = "连接失败：缺少 PyMySQL 驱动，请先安装后端依赖。"
        elif "psycopg2" in raw_message.lower():
            test_message = "连接失败：缺少 PostgreSQL 驱动，请先安装后端依赖。"
        elif "pyodbc" in raw_message.lower():
            test_message = "连接失败：缺少 SQL Server ODBC 驱动，请先安装后端依赖。"
        else:
            test_message = f"连接失败：{exc}"
    db.commit()
    db.refresh(item)
    data = serialize_datasource(item)
    data["test_message"] = test_message
    return data


@app.get("/api/users")
def list_users(
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [serialize_user(item) for item in db.query(User).order_by(User.id.asc()).all()]


@app.post("/api/users")
def create_user(
    payload: UserCreate,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    item = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=payload.status,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_user(item)


@app.put("/api/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return serialize_user(item)


@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    current: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot delete current user")
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.post("/api/users/bulk-delete")
def bulk_delete_users(
    ids: list[int],
    current: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    safe_ids = [item for item in ids if item != current.id]
    db.query(User).filter(User.id.in_(safe_ids)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}


@app.put("/api/users/{user_id}/password")
def update_password(
    user_id: int,
    payload: PasswordUpdate,
    current: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if current.id != user_id and current.role != "system_admin":
        raise HTTPException(status_code=403, detail="Permission denied")
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    if current.id == user_id and not verify_password(payload.old_password, item.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="新密码至少 8 位")
    item.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


@app.post("/api/users/{user_id}/avatar")
async def upload_avatar(
    user_id: int,
    file: UploadFile = File(...),
    current: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if current.id != user_id and current.role != "system_admin":
        raise HTTPException(status_code=403, detail="Permission denied")
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png"}:
        raise HTTPException(status_code=400, detail="Only JPG and PNG avatars are allowed")
    filename = f"avatar-{user_id}-{uuid4().hex}{suffix}"
    target = UPLOADS_DIR / filename
    target.write_bytes(await file.read())
    item.avatar_url = f"/uploads/{filename}"
    db.commit()
    db.refresh(item)
    return serialize_user(item)


@app.get("/api/system-settings")
def get_system_settings(db: Session = Depends(get_db)) -> dict:
    item = db.query(SystemSettings).first()
    if not item:
        item = SystemSettings(system_name="AstroCore", system_icon="Zap")
        db.add(item)
        db.commit()
        db.refresh(item)
    return {"system_name": item.system_name, "system_icon": item.system_icon, "logo_url": item.logo_url}


@app.put("/api/system-settings")
def update_system_settings(
    payload: SystemSettingsPayload,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.query(SystemSettings).first()
    if not item:
        item = SystemSettings()
        db.add(item)
    item.system_name = payload.system_name
    item.system_icon = payload.system_icon
    db.commit()
    db.refresh(item)
    return {"system_name": item.system_name, "system_icon": item.system_icon, "logo_url": item.logo_url}


@app.post("/api/system-settings/logo")
async def upload_logo(
    file: UploadFile = File(...),
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".svg"}:
        raise HTTPException(status_code=400, detail="Only JPG, PNG and SVG logos are allowed")
    filename = f"logo-{uuid4().hex}{suffix}"
    target = UPLOADS_DIR / filename
    target.write_bytes(await file.read())
    item = db.query(SystemSettings).first() or SystemSettings()
    item.logo_url = f"/uploads/{filename}"
    item.system_icon = ""
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"system_name": item.system_name, "system_icon": item.system_icon, "logo_url": item.logo_url}


@app.delete("/api/system-settings/logo")
def delete_logo(
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.query(SystemSettings).first()
    if not item:
        item = SystemSettings(system_name="AstroCore", system_icon="Zap")
        db.add(item)
    item.logo_url = None
    item.system_icon = item.system_icon or "Zap"
    db.commit()
    db.refresh(item)
    return {"system_name": item.system_name, "system_icon": item.system_icon, "logo_url": item.logo_url}
