from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(ORMModel):
    id: int
    username: str
    email: str
    role: str
    status: str
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class UserCreate(BaseModel):
    username: str
    email: str = ""
    password: str
    role: str = "viewer"
    status: str = "active"


class UserUpdate(BaseModel):
    email: str | None = None
    role: str | None = None
    status: str | None = None


class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str


class DashboardPayload(BaseModel):
    name: str
    category: str = ""
    icon: str = "BarChart3"
    dataset_id: int | None = None
    status: str = "draft"


class DatasetPayload(BaseModel):
    name: str
    datasource_id: int | None = None
    sql: str = ""


class DatasourcePayload(BaseModel):
    name: str
    type: str
    host: str
    port: int | None = None
    username: str
    password: str | None = None
    database: str = ""
    status: str = "pending"


class SystemSettingsPayload(BaseModel):
    system_name: str
    system_icon: str = "Zap"


class PreviewResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    message: str | None = None
