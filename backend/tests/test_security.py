import hashlib

from app import main, security


def test_session_hash_matches_sha256_and_remains_available_from_main() -> None:
    token = "token-ficticio-seguridad"
    assert security.hash_session_token(token) == hashlib.sha256(token.encode("utf-8")).hexdigest()
    assert main.hash_session_token is security.hash_session_token
    assert main.hash_password is security.hash_password
    assert main.verify_password is security.verify_password


def test_password_hash_uses_random_salt_and_current_format() -> None:
    password = "clave-ficticia-prueba"
    salt, digest = security.hash_password(password)
    second_salt, _ = security.hash_password(password)
    assert len(bytes.fromhex(salt)) == 16
    assert len(bytes.fromhex(digest)) == 32
    assert salt != second_salt
    assert digest == hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), 210_000,
    ).hex()
    assert security.verify_password(password, salt, digest)
    assert not security.verify_password("otra-clave-ficticia", salt, digest)


def test_verification_accepts_existing_pbkdf2_hash_without_rehashing() -> None:
    salt = "00112233445566778899aabbccddeeff"
    password = "contraseña ficticia persistida"
    stored_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), 210_000,
    ).hex()
    assert security.verify_password(password, salt, stored_hash)
    assert not security.verify_password(password + "x", salt, stored_hash)
