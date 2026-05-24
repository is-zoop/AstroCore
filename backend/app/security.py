import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta
from typing import Any

from .config import JWT_EXPIRE_MINUTES, JWT_SECRET


PBKDF2_ITERATIONS = 210_000
SECRET_ENCRYPTION_PREFIX = "encv1$"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${_b64_encode(salt)}${_b64_encode(digest)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, rounds, salt_b64, digest_b64 = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = _b64_decode(salt_b64)
        expected = _b64_decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(subject: str, role: str) -> tuple[str, int]:
    expires = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    header = {"alg": "HS256", "typ": "JWT"}
    payload: dict[str, Any] = {"sub": subject, "role": role, "exp": int(expires.timestamp())}
    signing_input = ".".join([
        _b64_encode(json.dumps(header, separators=(",", ":")).encode()),
        _b64_encode(json.dumps(payload, separators=(",", ":")).encode()),
    ])
    signature = hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64_encode(signature)}", JWT_EXPIRE_MINUTES * 60


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}"
        expected = hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64_encode(expected), signature_b64):
            return None
        payload = json.loads(_b64_decode(payload_b64))
        if int(payload.get("exp", 0)) < int(datetime.utcnow().timestamp()):
            return None
        return payload
    except Exception:
        return None


def encrypt_secret(value: str | None) -> str | None:
    if not value:
        return None
    nonce = secrets.token_bytes(16)
    key = hashlib.sha256(JWT_SECRET.encode() + nonce).digest()
    raw = value.encode()
    stream = _secret_stream(key, len(raw))
    encrypted = bytes(raw[i] ^ stream[i] for i in range(len(raw)))
    signature = hmac.new(key, encrypted, hashlib.sha256).digest()[:16]
    return f"{SECRET_ENCRYPTION_PREFIX}{_b64_encode(nonce)}${_b64_encode(signature)}${_b64_encode(encrypted)}"


def decrypt_secret(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith(SECRET_ENCRYPTION_PREFIX):
        _, nonce_b64, signature_b64, encrypted_b64 = value.split("$", 3)
        nonce = _b64_decode(nonce_b64)
        encrypted = _b64_decode(encrypted_b64)
        key = hashlib.sha256(JWT_SECRET.encode() + nonce).digest()
        expected_signature = hmac.new(key, encrypted, hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(expected_signature, _b64_decode(signature_b64)):
            raise ValueError("Invalid encrypted secret signature")
        stream = _secret_stream(key, len(encrypted))
        return bytes(encrypted[i] ^ stream[i] for i in range(len(encrypted))).decode()
    key = hashlib.sha256(JWT_SECRET.encode()).digest()
    encrypted = _b64_decode(value)
    raw = bytes(encrypted[i] ^ key[i % len(key)] for i in range(len(encrypted)))
    return raw.decode()


def is_current_encrypted_secret(value: str | None) -> bool:
    return bool(value and value.startswith(SECRET_ENCRYPTION_PREFIX))


def generate_api_key() -> str:
    return f"acpk_{secrets.token_urlsafe(32)}"


def hash_api_key(api_key: str) -> str:
    return hmac.new(JWT_SECRET.encode(), api_key.encode("utf-8"), hashlib.sha256).hexdigest()


def mask_api_key(api_key: str) -> str:
    return f"{api_key[:4]}{'*' * 28}"


def _secret_stream(key: bytes, length: int) -> bytes:
    chunks = []
    counter = 0
    while sum(len(chunk) for chunk in chunks) < length:
        chunks.append(hmac.new(key, counter.to_bytes(4, "big"), hashlib.sha256).digest())
        counter += 1
    return b"".join(chunks)[:length]
