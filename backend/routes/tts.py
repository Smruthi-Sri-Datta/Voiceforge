from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Voice, Generation
from backend.routes.auth import get_current_user
from supabase import create_client
import httpx
import uuid
import os
import base64

router = APIRouter()

SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_SERVICE_KEY")
RUNPOD_URL     = os.getenv("RUNPOD_URL")        # https://api.runpod.ai/v2/bcgrtz1xbml3iw/runsync
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")
BACKEND_URL    = os.getenv("BACKEND_URL")       # https://voiceforge-4v8l.onrender.com

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def runpod_base_url():
    return RUNPOD_URL.replace("/runsync", "")


def delete_from_supabase(bucket: str, filename: str):
    try:
        supabase.storage.from_(bucket).remove([filename])
    except Exception as e:
        print(f"Failed to delete from Supabase: {e}")


# ── Request Models ────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    text:     str
    speaker:  str = "Ana Florence"
    language: str = "en"
    speed:    float = 1.0
    voice_id: Optional[str] = None


# ── Static Routes ─────────────────────────────────────────────────────────────

@router.get("/languages")
def get_languages():
    return {"languages": [
        {"code": "en",    "name": "🇬🇧 English",    "engine": "xtts"},
        {"code": "fr",    "name": "🇫🇷 French",     "engine": "xtts"},
        {"code": "de",    "name": "🇩🇪 German",     "engine": "xtts"},
        {"code": "es",    "name": "🇪🇸 Spanish",    "engine": "xtts"},
        {"code": "ja",    "name": "🇯🇵 Japanese",   "engine": "xtts"},
        {"code": "zh-cn", "name": "🇨🇳 Chinese",    "engine": "xtts"},
        {"code": "hi",    "name": "🇮🇳 Hindi",      "engine": "sarvam"},
        {"code": "bn",    "name": "🇮🇳 Bengali",    "engine": "sarvam"},
        {"code": "ta",    "name": "🇮🇳 Tamil",      "engine": "sarvam"},
        {"code": "te",    "name": "🇮🇳 Telugu",     "engine": "sarvam"},
        {"code": "gu",    "name": "🇮🇳 Gujarati",   "engine": "sarvam"},
        {"code": "kn",    "name": "🇮🇳 Kannada",    "engine": "sarvam"},
        {"code": "ml",    "name": "🇮🇳 Malayalam",  "engine": "sarvam"},
        {"code": "mr",    "name": "🇮🇳 Marathi",    "engine": "sarvam"},
        {"code": "pa",    "name": "🇮🇳 Punjabi",    "engine": "sarvam"},
        {"code": "or",    "name": "🇮🇳 Odia",       "engine": "sarvam"},
    ]}


@router.get("/voices")
def get_voices():
    # Hardcoded — no RunPod needed for static list
    return {"voices": []}


# ── Core Generation (Webhook Pattern) ────────────────────────────────────────

@router.post("/generate")
def generate_audio(
    request: GenerateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Step 1 of 3: Submit job to RunPod async.
    RunPod returns job_id instantly (<2s).
    RunPod will call /api/webhook/runpod when done.
    Frontend polls /api/status/{job_id} every 3s.
    """
    # Resolve custom voice URL if needed
    voice_url = None
    if request.voice_id:
        voice = db.query(Voice).filter(
            Voice.id == request.voice_id,
            Voice.user_id == current_user.id
        ).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        voice_url = voice.audio_url

    webhook_url = f"{BACKEND_URL}/api/webhook/runpod"

    try:
        response = httpx.post(
            f"{runpod_base_url()}/run",
            headers={
                "Authorization": f"Bearer {RUNPOD_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "input": {
                    "action":    "generate",
                    "text":      request.text,
                    "speaker":   request.speaker,
                    "language":  request.language,
                    "speed":     request.speed,
                    "voice_id":  request.voice_id,
                    "voice_url": voice_url,
                },
                "webhook": webhook_url   # RunPod POSTs here when job completes
            },
            timeout=30,
        )
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"RunPod submit failed: {str(e)}")

    data = response.json()
    job_id = data.get("id")
    if not job_id:
        raise HTTPException(status_code=502, detail="RunPod did not return a job ID")

    return {"job_id": job_id, "status": "IN_QUEUE"}


@router.post("/webhook/runpod")
def runpod_webhook(payload: dict, db: Session = Depends(get_db)):
    """
    Step 2 of 3: RunPod calls this endpoint when the job finishes.
    We save the result to DB so /status can return it instantly.
    No auth needed — RunPod calls this internally.
    """
    status = payload.get("status")
    job_id = payload.get("id")
    output = payload.get("output", {})

    print(f"[Webhook] job_id={job_id} status={status}")

    if status == "COMPLETED" and job_id:
        audio_url = output.get("audio_url")
        try:
            existing = db.query(Generation).filter(Generation.id == job_id).first()
            if not existing:
                generation = Generation(
                    id        = job_id,
                    user_id   = "webhook",   # placeholder; updated when user views history
                    text      = "Generated audio",
                    language  = "en",
                    speaker   = "Unknown",
                    file_path = f"supabase://{job_id}.mp3",
                    audio_url = audio_url,
                )
                db.add(generation)
                db.commit()
                print(f"[Webhook] Saved audio_url={audio_url}")
        except Exception as e:
            print(f"[Webhook] DB save error: {e}")

    return {"status": "ok"}


@router.get("/status/{job_id}")
def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Step 3 of 3: Frontend polls this every 3s.
    First checks DB (instant) — populated by webhook.
    Falls back to RunPod API if webhook hasn't fired yet.
    """
    # Fast path: webhook already saved result to DB
    generation = db.query(Generation).filter(Generation.id == job_id).first()
    if generation and generation.audio_url:
        return {
            "status":    "COMPLETED",
            "audio_url": generation.audio_url,
        }

    # Fallback: ask RunPod directly (webhook may not have fired yet)
    try:
        response = httpx.get(
            f"{runpod_base_url()}/status/{job_id}",
            headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"},
            timeout=10,
        )
        result = response.json()
        rp_status = result.get("status")

        if rp_status == "COMPLETED":
            output = result.get("output", {})
            return {
                "status":    "COMPLETED",
                "audio_url": output.get("audio_url"),
                "warning":   output.get("warning"),
            }
        elif rp_status == "FAILED":
            return {"status": "FAILED", "error": result.get("error", "Job failed")}
        else:
            return {"status": rp_status}   # IN_QUEUE or IN_PROGRESS

    except Exception:
        return {"status": "IN_QUEUE"}


# ── Voice Cloning ─────────────────────────────────────────────────────────────

@router.post("/clone-voice")
async def clone_voice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    content   = await file.read()
    audio_b64 = base64.b64encode(content).decode("utf-8")

    webhook_url = f"{BACKEND_URL}/api/webhook/runpod"

    try:
        response = httpx.post(
            f"{runpod_base_url()}/run",
            headers={
                "Authorization": f"Bearer {RUNPOD_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "input": {
                    "action":    "clone_voice",
                    "audio_b64": audio_b64,
                },
                "webhook": webhook_url
            },
            timeout=30,
        )
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"RunPod submit failed: {str(e)}")

    job_id = response.json().get("id")

    # Count existing voices for auto-naming
    voice_count = db.query(Voice).filter(Voice.user_id == current_user.id).count()
    voice_name  = f"V{voice_count + 1}"

    return {"job_id": job_id, "name": voice_name, "status": "processing"}


# ── History & Voice Management ────────────────────────────────────────────────

@router.get("/my-voices")
def get_my_voices(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    voices = db.query(Voice).filter(
        Voice.user_id == current_user.id
    ).order_by(Voice.created_at.desc()).all()

    return {"voices": [
        {
            "voice_id":   v.id,
            "name":       v.name,
            "audio_url":  v.audio_url,
            "created_at": v.created_at.isoformat(),
        }
        for v in voices if v.audio_url
    ]}


@router.get("/my-history")
def get_my_history(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    generations = db.query(Generation).filter(
        Generation.user_id == current_user.id
    ).order_by(Generation.created_at.desc()).limit(50).all()

    return {"generations": [
        {
            "id":         g.id,
            "text":       g.text,
            "language":   g.language,
            "speaker":    g.speaker,
            "file":       f"{g.id}.mp3",
            "audio_url":  g.audio_url,
            "created_at": g.created_at.isoformat(),
        }
        for g in generations
    ]}


@router.delete("/my-voices/{voice_id}")
def delete_voice(
    voice_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    voice = db.query(Voice).filter(
        Voice.id == voice_id,
        Voice.user_id == current_user.id
    ).first()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    delete_from_supabase("voices", f"{voice_id}.wav")
    db.delete(voice)
    db.commit()
    return {"message": "Voice deleted"}


@router.delete("/my-history/{generation_id}")
def delete_generation(
    generation_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    generation = db.query(Generation).filter(
        Generation.id == generation_id,
        Generation.user_id == current_user.id
    ).first()
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    delete_from_supabase("audio", f"{generation_id}.mp3")
    db.delete(generation)
    db.commit()
    return {"message": "Generation deleted"}


@router.delete("/my-history")
def clear_history(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    generations = db.query(Generation).filter(
        Generation.user_id == current_user.id
    ).all()
    for g in generations:
        delete_from_supabase("audio", f"{g.id}.mp3")
        db.delete(g)
    db.commit()
    return {"message": "History cleared"}
