import bcrypt


def get_password_hash(password: str) -> str:
    """
    Hash password using bcrypt (standard passlib/bcrypt algorithm).
    Truncates at 72 bytes per bcrypt standard.
    """
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against stored bcrypt hash."""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
