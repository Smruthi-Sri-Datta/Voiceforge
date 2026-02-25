from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"
    id              = Column(String, primary_key=True)
    email           = Column(String, unique=True, nullable=False)
    name            = Column(String, nullable=False)
    picture         = Column(String, nullable=True)
    auth_provider   = Column(String, default="google")
    password_hash   = Column(String, nullable=True)
    is_verified     = Column(Boolean, default=False)
    otp_code        = Column(String, nullable=True)
    otp_expires_at  = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    last_login      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    voices      = relationship("Voice", back_populates="user", cascade="all, delete-orphan")
    generations = relationship("Generation", back_populates="user", cascade="all, delete-orphan")


class Voice(Base):
    __tablename__ = "voices"
    id          = Column(String, primary_key=True)  # uuid, also the filename
    user_id     = Column(String, ForeignKey("users.id"), nullable=False)
    name        = Column(String, nullable=False)
    file_path   = Column(String, nullable=False)
    audio_url   = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user        = relationship("User", back_populates="voices")


class Generation(Base):
    __tablename__ = "generations"
    id          = Column(String, primary_key=True)  # uuid, also the filename
    user_id     = Column(String, ForeignKey("users.id"), nullable=False)
    text        = Column(Text, nullable=False)
    language    = Column(String, nullable=False)
    speaker     = Column(String, nullable=False)
    file_path   = Column(String, nullable=False)
    audio_url   = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user        = relationship("User", back_populates="generations")