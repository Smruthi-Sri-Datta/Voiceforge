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

SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_SERVICE_KEY")
RUNPOD_URL    = os.getenv("RUNPOD_URL")       # https://api.runpod.ai/v2/bcgrtz1xbml3iw/runsync
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")  # rpa_...

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def delete_from_supabase(bucket: str, filename: str):
    try:
        supabase.storage.from_(bucket).remove([filename])
    except Exception as e:
        print(f"Failed to delete from Supabase: {e}")


def call_runpod(payload: dict, timeout: int = 300) -> dict:
    """Submit to RunPod async, poll until done."""
    import time
    base_url = RUNPOD_URL.replace("/runsync", "")

    # Submit job
    response = httpx.post(
        f"{base_url}/run",
        headers={"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"},
        json={"input": payload},
        timeout=30,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"RunPod submit error: {response.text}")

    job_id = response.json().get("id")

    # Poll for result
    for _ in range(60):
        time.sleep(5)
        status_resp = httpx.get(
            f"{base_url}/status/{job_id}",
            headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"},
            timeout=10,
        )
        result = status_resp.json()
        if result.get("status") == "COMPLETED":
            return result.get("output", {})
        if result.get("status") == "FAILED":
            raise HTTPException(status_code=500, detail=result.get("error", "RunPod job failed"))

    raise HTTPException(status_code=504, detail="RunPod job timed out")


# ── Request Models ────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    text:     str
    speaker:  str = "Ana Florence"
    language: str = "en"
    speed:    float = 1.0
    voice_id: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

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
    output = call_runpod({"action": "get_voices"})
    return output


@router.post("/generate")
def generate_audio(request: GenerateRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    base_url = RUNPOD_URL.replace("/runsync", "")
    response = httpx.post(
        f"{base_url}/run",
        headers={"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"},
        json={"input": {
            "action": "generate",
            "text": request.text,
            "speaker": request.speaker,
            "language": request.language,
            "speed": request.speed,
            "voice_id": request.voice_id,
        }},
        timeout=30,
    )
    job_id = response.json().get("id")
    return {"job_id": job_id, "status": "processing"}

    # Resolve voice_id to Supabase URL if custom voice
    voice_url = None
    if request.voice_id:
        voice = db.query(Voice).filter(
            Voice.id == request.voice_id,
            Voice.user_id == current_user.id
        ).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        voice_url = voice.audio_url

    # Call RunPod
    output = call_runpod({
        "action":    "generate",
        "text":      request.text,
        "speaker":   request.speaker,
        "language":  request.language,
        "speed":     request.speed,
        "voice_id":  request.voice_id,
        "voice_url": voice_url,
    })

    audio_url = output.get("audio_url")
    file_id   = output.get("file_id", str(uuid.uuid4()))
    filename  = output.get("filename", f"{file_id}.mp3")
    warning   = output.get("warning")

    # Save to DB
    generation = Generation(
        id        = file_id,
        user_id   = current_user.id,
        text      = request.text[:200],
        language  = request.language,
        speaker   = request.speaker,
        file_path = f"supabase://{filename}",
        audio_url = audio_url,
    )
    db.add(generation)
    db.commit()

    return {
        "message":   "Audio generated!",
        "file":      filename,
        "audio_url": audio_url,
        "warning":   warning,
    }


@router.post("/clone-voice")
async def clone_voice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    content = await file.read()
    audio_b64 = base64.b64encode(content).decode("utf-8")

    # Call RunPod to upload voice
    output = call_runpod({
        "action":     "clone_voice",
        "audio_b64":  audio_b64,
    })

    voice_id  = output.get("voice_id", str(uuid.uuid4()))
    voice_url = output.get("audio_url")

    # Count existing voices for auto-naming
    voice_count = db.query(Voice).filter(Voice.user_id == current_user.id).count()
    voice_name  = f"V{voice_count + 1}"

    voice = Voice(
        id        = voice_id,
        user_id   = current_user.id,
        name      = voice_name,
        file_path = f"supabase://{voice_id}.wav",
        audio_url = voice_url,
    )
    db.add(voice)
    db.commit()

    return {"voice_id": voice_id, "name": voice_name}

@router.get("/status/{job_id}")
def get_job_status(job_id: str, current_user=Depends(get_current_user)):
    base_url = RUNPOD_URL.replace("/runsync", "")
    response = httpx.get(
        f"{base_url}/status/{job_id}",
        headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"},
        timeout=10,
    )
    result = response.json()
    status = result.get("status")
    if status == "COMPLETED":
        output = result.get("output", {})
        return {"status": "COMPLETED", "audio_url": output.get("audio_url"), "warning": output.get("warning")}
    elif status == "FAILED":
        return {"status": "FAILED", "error": result.get("error")}
    else:
        return {"status": status}


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
    return {"message": "History cleared"}# Note: replace call_runpod with async version
