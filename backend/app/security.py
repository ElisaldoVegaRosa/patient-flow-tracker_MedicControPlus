import hashlib
import secrets

from .config import PASSWORD_HASH_ITERATIONS


def hash_session_token(token: str) -> str:
    """Genera una representación irreversible del token de sesión."""

    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

def hash_password(password: str) -> tuple[str, str]:
    """Genera una sal y un hash PBKDF2 para una contraseña."""

    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )

    return salt.hex(), password_hash.hex()


def verify_password(
    password: str,
    password_salt: str,
    expected_hash: str,
) -> bool:
    """Compara una contraseña con su hash almacenado."""

    candidate_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(password_salt),
        PASSWORD_HASH_ITERATIONS,
    ).hex()

    return secrets.compare_digest(
        candidate_hash,
        expected_hash,
    )
