from pathlib import Path
from datetime import timezone
from urllib.parse import quote_plus
from shutil import rmtree
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine as create_sqlalchemy_engine, func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, object_session

from .config import APP_ORIGIN, DASHBOARD_FILES_DIR, TABLE_UPLOADS_DIR, UPLOADS_DIR
from .database import Base, SessionLocal, engine, get_db
from .deps import current_user, require_dataset_admin, require_public_data_api_key, require_system_admin
from .models import ApiKey, Dashboard, Dataset, Datasource, SystemSettings, User
from .schemas import (
    ApiKeyUpdate,
    DashboardPayload,
    DatasetPayload,
    DatasourcePayload,
    LoginRequest,
    LoginResponse,
    PasswordUpdate,
    PreviewResponse,
    SystemSettingsPayload,
    TableDatasetPayload,
    UserCreate,
    UserOut,
    UserUpdate,
)
from .security import create_access_token, decrypt_secret, encrypt_secret, generate_api_key, hash_api_key, hash_password, is_current_encrypted_secret, mask_api_key, verify_password


OPENAPI_TAGS = [
    {"name": "Health", "description": "服务健康检查"},
    {"name": "Auth", "description": "登录、登出和当前用户"},
    {"name": "Dashboards", "description": "看板管理、发布、上传和展示"},
    {"name": "Datasets", "description": "数据集管理、表格导入、预览和查询"},
    {"name": "Public Data", "description": "公开数据查询接口，供看板 HTML 等外部页面调用"},
    {"name": "API Keys", "description": "Public Data API Key 管理"},
    {"name": "Datasources", "description": "数据源管理和连通性测试"},
    {"name": "Users", "description": "用户、密码和头像管理"},
    {"name": "System Settings", "description": "系统名称、图标和 Logo 配置"},
    {"name": "Search", "description": "全局搜索接口"},
]


app = FastAPI(title="AstroCore API", openapi_tags=OPENAPI_TAGS)

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
    with engine.begin() as connection:
        dashboard_columns = [row[1] for row in connection.execute(text("PRAGMA table_info(dashboards)"))]
        if "description" not in dashboard_columns:
            connection.execute(text("ALTER TABLE dashboards ADD COLUMN description TEXT NOT NULL DEFAULT ''"))
        if "dataset_ids" not in dashboard_columns:
            connection.execute(text("ALTER TABLE dashboards ADD COLUMN dataset_ids VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("UPDATE dashboards SET dataset_ids = CAST(dataset_id AS TEXT) WHERE dataset_id IS NOT NULL AND dataset_ids = ''"))
        dataset_columns = [row[1] for row in connection.execute(text("PRAGMA table_info(datasets)"))]
        if "table_name" not in dataset_columns:
            connection.execute(text("ALTER TABLE datasets ADD COLUMN table_name VARCHAR(255) NOT NULL DEFAULT ''"))
        if "table_file_name" not in dataset_columns:
            connection.execute(text("ALTER TABLE datasets ADD COLUMN table_file_name VARCHAR(255) NOT NULL DEFAULT ''"))
        if "table_sheet_name" not in dataset_columns:
            connection.execute(text("ALTER TABLE datasets ADD COLUMN table_sheet_name VARCHAR(255) NOT NULL DEFAULT ''"))
        api_key_columns = [row[1] for row in connection.execute(text("PRAGMA table_info(api_keys)"))]
        if api_key_columns and "key_encrypted" not in api_key_columns:
            connection.execute(text("ALTER TABLE api_keys ADD COLUMN key_encrypted TEXT"))
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
        if not db.query(Datasource).filter(Datasource.type == "table").first():
            db.add(
                Datasource(
                    name="表格数据源",
                    type="table",
                    host="local-file",
                    port=None,
                    username="local",
                    password_encrypted="",
                    database="astrocore",
                    status="online",
                )
            )
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


def format_local_time(value) -> str:
    return value.replace(tzinfo=timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")


def serialize_dashboard(dashboard: Dashboard) -> dict:
    dataset_ids = get_dashboard_dataset_ids(dashboard)
    datasets = []
    if dataset_ids:
        session = object_session(dashboard)
        datasets = [item.name for item in session.query(Dataset).filter(Dataset.id.in_(dataset_ids)).all()] if session else []
    return {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "category": dashboard.category,
        "icon": dashboard.icon,
        "dataset_ids": dataset_ids,
        "dataset_id": dashboard.dataset_id,
        "dataset": ", ".join(datasets) if datasets else (dashboard.dataset.name if dashboard.dataset else ""),
        "status": dashboard.status,
        "owner": dashboard.owner.username if dashboard.owner else "",
        "owner_id": dashboard.owner_id,
        "updated_at": format_local_time(dashboard.updated_at),
        "created_at": format_local_time(dashboard.created_at),
        "file_url": dashboard.file_url,
    }


def get_dashboard_dataset_ids(dashboard: Dashboard) -> list[int]:
    dataset_ids = [int(item) for item in (dashboard.dataset_ids or "").split(",") if item.strip().isdigit()]
    if not dataset_ids and dashboard.dataset_id:
        dataset_ids = [dashboard.dataset_id]
    return dataset_ids


def ensure_dashboard_name_unique(db: Session, name: str, dashboard_id: int | None = None) -> str:
    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Dashboard name is required")
    query = db.query(Dashboard).filter(func.trim(Dashboard.name) == normalized_name)
    if dashboard_id is not None:
        query = query.filter(Dashboard.id != dashboard_id)
    if query.first():
        raise HTTPException(status_code=400, detail="Dashboard name already exists")
    return normalized_name


def serialize_dataset(dataset: Dataset) -> dict:
    return {
        "id": dataset.id,
        "name": dataset.name,
        "datasource_id": dataset.datasource_id,
        "owner": dataset.owner.username if dataset.owner else "",
        "owner_id": dataset.owner_id,
        "sql": dataset.sql,
        "table_name": dataset.table_name,
        "table_file_name": dataset.table_file_name,
        "table_sheet_name": dataset.table_sheet_name,
        "created_at": format_local_time(dataset.created_at),
        "updated_at": format_local_time(dataset.updated_at),
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
        "created_at": format_local_time(source.created_at),
        "updated_at": format_local_time(source.updated_at),
    }


def serialize_api_key(item: ApiKey, include_secret: bool = False, plain_key: str | None = None) -> dict:
    secret = plain_key
    if include_secret and not secret and item.key_encrypted:
        secret = decrypt_secret(item.key_encrypted)
    data = {
        "id": item.id,
        "name": item.name,
        "key_prefix": item.key_prefix,
        "key_mask": mask_api_key(secret) if secret else item.key_prefix,
        "permission": item.permission,
        "status": item.status,
        "created_by": item.created_by.username if item.created_by else "",
        "created_at": format_local_time(item.created_at),
        "updated_at": format_local_time(item.updated_at),
    }
    if include_secret and secret:
        data["key"] = secret
    return data


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
    if source.type == "table":
        return str(engine.url)
    raise HTTPException(status_code=400, detail="Unsupported datasource type")


def execute_dataset_sql(dataset: Dataset, limit: int | None = None) -> dict:
    sql = dataset.sql.strip().rstrip(";")
    if not sql.lower().startswith("select"):
        raise HTTPException(status_code=400, detail="Only SELECT statements can be queried")
    if not dataset.datasource:
        raise HTTPException(status_code=400, detail="Dataset has no bound datasource")

    statement = f"SELECT * FROM ({sql}) AS dataset_source"
    if limit:
        statement = f"{statement} LIMIT {limit}"

    query_engine = None
    try:
        query_engine = create_sqlalchemy_engine(
            build_datasource_url(dataset.datasource),
            pool_pre_ping=True,
            connect_args={"connect_timeout": 5} if dataset.datasource.type == "mysql" else {},
        )
        with query_engine.connect() as connection:
            result = connection.execute(text(statement))
            rows = [dict(row._mapping) for row in result]
        columns = list(rows[0].keys()) if rows else []
        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "message": None if rows else "SQL executed successfully, but no data was returned",
        }
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=400, detail=f"Dataset query failed: {exc}") from exc
    finally:
        if query_engine:
            query_engine.dispose()


def read_table_sheets(path: Path) -> list[str]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return ["CSV"]
    if suffix in {".xlsx", ".xls"}:
        try:
            import pandas as pd
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="Please install pandas/openpyxl/xlrd to import Excel files") from exc
        return list(pd.ExcelFile(path).sheet_names)
    raise HTTPException(status_code=400, detail="Only xlsx, xls and csv files are supported")


def import_table_file(dataset: Dataset, path: Path, sheet_name: str) -> None:
    suffix = path.suffix.lower()
    try:
        import pandas as pd
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="Please install pandas/openpyxl/xlrd to import table files") from exc

    if suffix == ".csv":
        frame = pd.read_csv(path)
    elif suffix in {".xlsx", ".xls"}:
        frame = pd.read_excel(path, sheet_name=sheet_name)
    else:
        raise HTTPException(status_code=400, detail="Only xlsx, xls and csv files are supported")

    table_name = f"imported_dataset_{dataset.id}"
    frame.to_sql(table_name, engine, if_exists="replace", index=False)
    dataset.table_name = table_name
    dataset.table_file_name = path.name
    dataset.table_sheet_name = sheet_name
    dataset.sql = f'SELECT * FROM "{table_name}"'


@app.get("/api/health", tags=["Health"])
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=LoginResponse, tags=["Auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="输入的账号或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号未激活")
    token, expires_in = create_access_token(str(user.id), user.role)
    return LoginResponse(access_token=token, expires_in=expires_in, user=user)


@app.get("/api/auth/me", tags=["Auth"])
def me(user: User = Depends(current_user)) -> dict:
    return serialize_user(user)


@app.post("/api/auth/logout", tags=["Auth"])
def logout() -> dict:
    return {"ok": True}


@app.get("/api/dashboards", tags=["Dashboards"])
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


@app.post("/api/dashboards", tags=["Dashboards"])
def create_dashboard(
    payload: DashboardPayload,
    user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    dataset_ids = payload.dataset_ids or ([payload.dataset_id] if payload.dataset_id else [])
    if not dataset_ids:
        raise HTTPException(status_code=400, detail="Dashboard must bind a dataset")
    data = payload.model_dump()
    data["name"] = ensure_dashboard_name_unique(db, payload.name)
    data["dataset_id"] = dataset_ids[0]
    data["dataset_ids"] = ",".join(str(item) for item in dataset_ids)
    item = Dashboard(**data, owner_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_dashboard(item)


@app.put("/api/dashboards/{dashboard_id}", tags=["Dashboards"])
def update_dashboard(
    dashboard_id: int,
    payload: DashboardPayload,
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dashboard, dashboard_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    dataset_ids = payload.dataset_ids or ([payload.dataset_id] if payload.dataset_id else [])
    if not dataset_ids:
        raise HTTPException(status_code=400, detail="Dashboard must bind a dataset")
    data = payload.model_dump()
    data["name"] = ensure_dashboard_name_unique(db, payload.name, dashboard_id)
    data["dataset_id"] = dataset_ids[0]
    data["dataset_ids"] = ",".join(str(item) for item in dataset_ids)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return serialize_dashboard(item)


@app.delete("/api/dashboards/{dashboard_id}", tags=["Dashboards"])
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


@app.post("/api/dashboards/{dashboard_id}/file", tags=["Dashboards"])
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


@app.get("/api/dashboards/{dashboard_id}/view", tags=["Dashboards"])
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


@app.get("/api/search/dashboards", tags=["Search"])
def search_dashboards(
    keyword: str = "",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Dashboard).filter(Dashboard.status == "published")
    if keyword:
        query = query.filter(Dashboard.name.contains(keyword))
    return [serialize_dashboard(item) for item in query.limit(20).all()]


@app.get("/api/datasets", tags=["Datasets"])
def list_datasets(
    keyword: str = "",
    _: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Dataset)
    if keyword:
        query = query.filter(Dataset.name.contains(keyword))
    return [serialize_dataset(item) for item in query.order_by(Dataset.updated_at.desc()).all()]


@app.post("/api/datasets", tags=["Datasets"])
def create_dataset(
    payload: DatasetPayload,
    user: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    if not payload.datasource_id:
        raise HTTPException(status_code=400, detail="Dataset must bind a datasource")
    item = Dataset(**payload.model_dump(), owner_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_dataset(item)


@app.put("/api/datasets/{dataset_id}", tags=["Datasets"])
def update_dataset(
    dataset_id: int,
    payload: DatasetPayload,
    _: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dataset, dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not payload.datasource_id:
        raise HTTPException(status_code=400, detail="Dataset must bind a datasource")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return serialize_dataset(item)


@app.delete("/api/datasets/{dataset_id}", tags=["Datasets"])
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


@app.post("/api/table-files/sheets", tags=["Datasets"])
async def upload_table_file_sheets(
    file: UploadFile = File(...),
    _: User = Depends(require_dataset_admin),
) -> dict:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".xlsx", ".xls", ".csv"}:
        raise HTTPException(status_code=400, detail="Only xlsx, xls and csv files are supported")
    temp_id = uuid4().hex
    target = TABLE_UPLOADS_DIR / f"{temp_id}{suffix}"
    target.write_bytes(await file.read())
    return {"temp_id": temp_id, "filename": file.filename, "sheets": read_table_sheets(target)}


@app.post("/api/datasets/table", tags=["Datasets"])
def create_table_dataset(
    payload: TableDatasetPayload,
    user: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    source = db.get(Datasource, payload.datasource_id)
    if not source or source.type != "table":
        raise HTTPException(status_code=400, detail="Please select table datasource")
    matches = list(TABLE_UPLOADS_DIR.glob(f"{payload.temp_id}.*"))
    if not matches:
        raise HTTPException(status_code=400, detail="Uploaded table file not found")
    path = matches[0]
    sheets = read_table_sheets(path)
    if payload.sheet_name not in sheets:
        raise HTTPException(status_code=400, detail="Sheet not found")
    item = Dataset(name=payload.name, datasource_id=source.id, owner_id=user.id, sql="")
    db.add(item)
    db.commit()
    db.refresh(item)
    try:
        import_table_file(item, path, payload.sheet_name)
        db.commit()
        db.refresh(item)
    except Exception as exc:
        db.rollback()
        cleanup_item = db.get(Dataset, item.id)
        if cleanup_item:
            db.delete(cleanup_item)
            db.commit()
        raise HTTPException(status_code=400, detail=f"Table import failed: {exc}") from exc
    return serialize_dataset(item)


@app.put("/api/datasets/{dataset_id}/table", tags=["Datasets"])
def update_table_dataset(
    dataset_id: int,
    payload: TableDatasetPayload,
    _: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(Dataset, dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dataset not found")
    source = db.get(Datasource, payload.datasource_id)
    if not source or source.type != "table":
        raise HTTPException(status_code=400, detail="Please select table datasource")
    matches = list(TABLE_UPLOADS_DIR.glob(f"{payload.temp_id}.*"))
    if not matches:
        raise HTTPException(status_code=400, detail="Uploaded table file not found")
    path = matches[0]
    sheets = read_table_sheets(path)
    if payload.sheet_name not in sheets:
        raise HTTPException(status_code=400, detail="Sheet not found")
    item.name = payload.name
    item.datasource_id = source.id
    try:
        import_table_file(item, path, payload.sheet_name)
        db.commit()
        db.refresh(item)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Table import failed: {exc}") from exc
    return serialize_dataset(item)


@app.post("/api/datasets/{dataset_id}/preview", response_model=PreviewResponse, tags=["Datasets"])
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


@app.get("/api/datasets/by-name/data", tags=["Datasets"])
def dataset_data_by_name(
    name: str,
    _: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.query(Dataset).filter(Dataset.name == name).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return execute_dataset_sql(item)


@app.get("/api/public/datasets/by-name/data", tags=["Public Data"])
def public_dataset_data_by_name(
    name: str,
    _: ApiKey = Depends(require_public_data_api_key),
    db: Session = Depends(get_db),
) -> dict:
    item = db.query(Dataset).filter(Dataset.name == name).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return execute_dataset_sql(item)


@app.get("/api/public/dashboards/by-name/data", tags=["Public Data"])
def public_dashboard_data_by_name(
    name: str,
    _: ApiKey = Depends(require_public_data_api_key),
    db: Session = Depends(get_db),
) -> dict:
    dashboard_name = name.strip()
    item = db.query(Dashboard).filter(Dashboard.name == dashboard_name).first()
    if not item:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    dataset_ids = get_dashboard_dataset_ids(item)
    if not dataset_ids:
        raise HTTPException(status_code=400, detail="Dashboard has no bound dataset")

    datasets = db.query(Dataset).filter(Dataset.id.in_(dataset_ids)).all()
    datasets_by_id = {dataset.id: dataset for dataset in datasets}
    ordered_datasets = [datasets_by_id[dataset_id] for dataset_id in dataset_ids if dataset_id in datasets_by_id]
    if not ordered_datasets:
        raise HTTPException(status_code=404, detail="Bound dataset not found")

    if len(ordered_datasets) == 1:
        return execute_dataset_sql(ordered_datasets[0])

    return {
        "dashboard_id": item.id,
        "dashboard_name": item.name,
        "datasets": [execute_dataset_sql(dataset) for dataset in ordered_datasets],
    }


@app.get("/api/api-keys", tags=["API Keys"])
def list_api_keys(
    user: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    item = db.query(ApiKey).filter(ApiKey.created_by_id == user.id).order_by(ApiKey.updated_at.desc()).first()
    return [serialize_api_key(item, include_secret=True)] if item else []


@app.post("/api/api-keys", tags=["API Keys"])
def create_api_key(
    user: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    if db.query(ApiKey).filter(ApiKey.created_by_id == user.id).first():
        raise HTTPException(status_code=400, detail="Only one API Key can be generated")
    raw_key = generate_api_key()
    item = ApiKey(
        name="Public Data",
        key_hash=hash_api_key(raw_key),
        key_prefix=mask_api_key(raw_key),
        key_encrypted=encrypt_secret(raw_key),
        permission="public_data",
        status="active",
        created_by_id=user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_api_key(item, include_secret=True, plain_key=raw_key)


@app.put("/api/api-keys/{key_id}", tags=["API Keys"])
def update_api_key(
    key_id: int,
    payload: ApiKeyUpdate,
    user: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(ApiKey, key_id)
    if not item or item.created_by_id != user.id:
        raise HTTPException(status_code=404, detail="API Key not found")
    if payload.status not in {"active", "disabled"}:
        raise HTTPException(status_code=400, detail="Unsupported API Key status")
    item.name = "Public Data"
    item.status = payload.status
    raw_key = None
    if payload.regenerate:
        raw_key = generate_api_key()
        item.key_hash = hash_api_key(raw_key)
        item.key_prefix = mask_api_key(raw_key)
        item.key_encrypted = encrypt_secret(raw_key)
    db.commit()
    db.refresh(item)
    return serialize_api_key(item, include_secret=True, plain_key=raw_key)


@app.delete("/api/api-keys/{key_id}", tags=["API Keys"])
def delete_api_key(
    key_id: int,
    user: User = Depends(require_dataset_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(ApiKey, key_id)
    if not item or item.created_by_id != user.id:
        raise HTTPException(status_code=404, detail="API Key not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.get("/api/datasources", tags=["Datasources"])
def list_datasources(
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [serialize_datasource(item) for item in db.query(Datasource).order_by(Datasource.updated_at.desc()).all()]


@app.post("/api/datasources", tags=["Datasources"])
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


@app.put("/api/datasources/{source_id}", tags=["Datasources"])
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


@app.delete("/api/datasources/{source_id}", tags=["Datasources"])
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


@app.post("/api/datasources/{source_id}/test", tags=["Datasources"])
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


@app.get("/api/users", tags=["Users"])
def list_users(
    _: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [serialize_user(item) for item in db.query(User).order_by(User.id.asc()).all()]


@app.post("/api/users", tags=["Users"])
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


@app.put("/api/users/{user_id}", tags=["Users"])
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


@app.delete("/api/users/{user_id}", tags=["Users"])
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


@app.post("/api/users/bulk-delete", tags=["Users"])
def bulk_delete_users(
    ids: list[int],
    current: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
) -> dict:
    safe_ids = [item for item in ids if item != current.id]
    db.query(User).filter(User.id.in_(safe_ids)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}


@app.put("/api/users/{user_id}/password", tags=["Users"])
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


@app.post("/api/users/{user_id}/avatar", tags=["Users"])
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


@app.get("/api/system-settings", tags=["System Settings"])
def get_system_settings(db: Session = Depends(get_db)) -> dict:
    item = db.query(SystemSettings).first()
    if not item:
        item = SystemSettings(system_name="AstroCore", system_icon="Zap")
        db.add(item)
        db.commit()
        db.refresh(item)
    return {"system_name": item.system_name, "system_icon": item.system_icon, "logo_url": item.logo_url}


@app.put("/api/system-settings", tags=["System Settings"])
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


@app.post("/api/system-settings/logo", tags=["System Settings"])
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


@app.delete("/api/system-settings/logo", tags=["System Settings"])
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
