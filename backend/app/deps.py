from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, APIKeyQuery, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import ApiKey, User
from .security import decode_access_token, hash_api_key


bearer = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
api_key_query = APIKeyQuery(name="api_key", auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")
    return user


def require_roles(*roles: str):
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        return user

    return checker


def require_system_admin(user: User = Depends(require_roles("system_admin"))) -> User:
    return user


def require_dataset_admin(user: User = Depends(require_roles("system_admin", "admin"))) -> User:
    return user


def require_public_data_api_key(
    header_key: str | None = Depends(api_key_header),
    query_key: str | None = Depends(api_key_query),
    db: Session = Depends(get_db),
) -> ApiKey:
    raw_key = header_key or query_key
    if not raw_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key required")
    item = db.query(ApiKey).filter(ApiKey.key_hash == hash_api_key(raw_key)).first()
    if (
        not item
        or item.status != "active"
        or item.permission != "public_data"
        or not item.created_by
        or item.created_by.status != "active"
        or item.created_by.role not in {"system_admin", "admin"}
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return item
