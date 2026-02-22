from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
import httpx
import os
import uuid
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone
import re

from backend.database import get_db
from backend.models import User

router   = APIRouter()
security = HTTPBearer(auto_error=False)
pwd_ctx  = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Config ────────────────────────────────────────────────────
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SECRET_KEY           = os.getenv("SECRET_KEY", "change-this-in-production")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:5174")
BACKEND_URL          = os.getenv("BACKEND_URL", "http://localhost:8000")
REDIRECT_URI         = f"{BACKEND_URL}/api/auth/google/callback"

SMTP_EMAIL    = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

OTP_EXPIRY_MINUTES = 10


# ── Pydantic schemas ──────────────────────────────────────────
class RegisterRequest(BaseModel):
    email:    EmailStr
    password: str
    name:     str

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class OTPRequest(BaseModel):
    email: EmailStr
    otp:   str

class ResendOTPRequest(BaseModel):
    email: EmailStr


# ── JWT helpers ───────────────────────────────────────────────
def create_jwt(user: User) -> str:
    payload = {
        "sub":     user.id,
        "email":   user.email,
        "name":    user.name,
        "picture": user.picture,
        "exp":     datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt(credentials.credentials)
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── OTP helpers ───────────────────────────────────────────────
def generate_otp() -> str:
    return str(random.randint(100000, 999999))


def send_otp_email(to_email: str, name: str, otp: str):
    """Send OTP via Gmail SMTP. Falls back to console log if SMTP not configured."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"\n{'='*40}")
        print(f"  [DEV MODE] OTP for {to_email}: {otp}")
        print(f"{'='*40}\n")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your VoiceForge verification code"
        msg["From"]    = SMTP_EMAIL
        msg["To"]      = to_email

        html = f"""
        <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:2rem;">
          <div style="text-align:center;margin-bottom:2rem;">
            <div style="display:inline-flex;width:52px;height:52px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:14px;align-items:center;justify-content:center;font-size:1.5rem;">🎙️</div>
            <h2 style="color:#111;margin:1rem 0 0.25rem;">VoiceForge</h2>
            <p style="color:#888;margin:0;">Email Verification</p>
          </div>
          <p style="color:#333;line-height:1.6;">Hi {name},</p>
          <p style="color:#333;line-height:1.6;">Your verification code is:</p>
          <div style="text-align:center;margin:2rem 0;">
            <div style="display:inline-block;background:#f4f0ff;border:2px solid #7c3aed33;border-radius:12px;padding:1rem 2.5rem;">
              <span style="font-size:2.2rem;font-weight:800;letter-spacing:8px;color:#7c3aed;">{otp}</span>
            </div>
          </div>
          <p style="color:#666;font-size:0.88rem;line-height:1.6;">
            This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.<br>
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:2rem 0;">
          <p style="color:#aaa;font-size:0.78rem;text-align:center;">VoiceForge · AI Voice Platform</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

    except Exception as e:
        print(f"Email send failed: {e}")
        print(f"[FALLBACK] OTP for {to_email}: {otp}")


# ── Google OAuth ──────────────────────────────────────────────
@router.get("/auth/google")
async def google_login():
    params = {
        "client_id":     GOOGLE_CLIENT_ID,
        "redirect_uri":  REDIRECT_URI,
        "response_type": "code",
        "scope":         "openid email profile",
        "access_type":   "offline",
        "prompt":        "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/auth/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code":          code,
            "client_id":     GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri":  REDIRECT_URI,
            "grant_type":    "authorization_code",
        })
        token_data = token_resp.json()

        if "error" in token_data:
            raise HTTPException(status_code=400, detail=token_data.get("error_description", "OAuth error"))

        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        userinfo = userinfo_resp.json()

    # Match by email so Google + email accounts can coexist cleanly
    user = db.query(User).filter(User.email == userinfo["email"]).first()
    if not user:
        user = User(
            id=userinfo["id"],
            email=userinfo["email"],
            name=userinfo["name"],
            picture=userinfo.get("picture"),
            auth_provider="google",
            is_verified=True,
        )
        db.add(user)
    else:
        user.name          = userinfo["name"]
        user.picture       = userinfo.get("picture")
        user.is_verified   = True
        user.auth_provider = "google"

    db.commit()
    db.refresh(user)

    token = create_jwt(user)
    return RedirectResponse(f"{FRONTEND_URL}/?token={token}")


# ── Email: Register ───────────────────────────────────────────
@router.post("/auth/register")
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if not re.search(r'[A-Z]', body.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r'[a-z]', body.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter.")
    if not re.search(r'[0-9]', body.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not re.search(r'[!?<>@#$%^&*]', body.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character (!?<>@#$%^&*).")

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        if existing.auth_provider == "google":
            raise HTTPException(status_code=400, detail="This email is linked to a Google account. Please sign in with Google.")
        if existing.is_verified:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
        # Unverified — update and resend OTP
        otp = generate_otp()
        existing.otp_code       = otp
        existing.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        existing.name           = body.name
        existing.password_hash  = pwd_ctx.hash(body.password)
        db.commit()
        send_otp_email(body.email, body.name, otp)
        return {"message": "Verification code resent to your email.", "requires_otp": True}

    otp  = generate_otp()
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        name=body.name,
        password_hash=pwd_ctx.hash(body.password),
        auth_provider="email",
        is_verified=False,
        otp_code=otp,
        otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(user)
    db.commit()

    send_otp_email(body.email, body.name, otp)
    return {"message": "Account created! Check your email for a 6-digit verification code.", "requires_otp": True}


# ── Email: Login ──────────────────────────────────────────────
@router.post("/auth/login")
async def email_login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email.")

    if user.auth_provider == "google":
        raise HTTPException(status_code=400, detail="This account uses Google Sign-In. Please continue with Google.")

    if not user.password_hash or not pwd_ctx.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    if not user.is_verified:
        otp = generate_otp()
        user.otp_code       = otp
        user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        db.commit()
        send_otp_email(body.email, user.name, otp)
        raise HTTPException(status_code=403, detail="Email not verified. A new code has been sent to your inbox.")

    token = create_jwt(user)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "picture": user.picture}}


# ── Email: Verify OTP ─────────────────────────────────────────
@router.post("/auth/verify-otp")
async def verify_otp(body: OTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if user.is_verified:
        token = create_jwt(user)
        return {"token": token, "message": "Already verified."}

    now     = datetime.now(timezone.utc)
    otp_exp = user.otp_expires_at
    if otp_exp and otp_exp.tzinfo is None:
        otp_exp = otp_exp.replace(tzinfo=timezone.utc)

    if not user.otp_code or user.otp_code != body.otp:
        raise HTTPException(status_code=400, detail="Incorrect verification code.")

    if not otp_exp or now > otp_exp:
        raise HTTPException(status_code=400, detail="This code has expired. Please request a new one.")

    user.is_verified    = True
    user.otp_code       = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

    token = create_jwt(user)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "picture": user.picture}}


# ── Email: Resend OTP ─────────────────────────────────────────
@router.post("/auth/resend-otp")
async def resend_otp(body: ResendOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if user.is_verified:
        return {"message": "Account is already verified."}

    otp = generate_otp()
    user.otp_code       = otp
    user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    db.commit()

    send_otp_email(body.email, user.name, otp)
    return {"message": "A new verification code has been sent."}


# ── Shared ────────────────────────────────────────────────────
@router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id":      current_user.id,
        "email":   current_user.email,
        "name":    current_user.name,
        "picture": current_user.picture,
    }


@router.post("/auth/logout")
async def logout():
    return {"message": "Logged out successfully"}