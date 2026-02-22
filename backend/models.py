from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.sql import func
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True)   # Google sub OR uuid for email users
    email           = Column(String, unique=True, nullable=False)
    name            = Column(String, nullable=False)
    picture         = Column(String, nullable=True)

    # ── Email auth fields ─────────────────────────────────────
    auth_provider   = Column(String, default="google")   # "google" | "email"
    password_hash   = Column(String, nullable=True)      # bcrypt hash, null for Google users
    is_verified     = Column(Boolean, default=False)     # email verified via OTP
    otp_code        = Column(String, nullable=True)      # 6-digit OTP
    otp_expires_at  = Column(DateTime(timezone=True), nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    last_login      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())