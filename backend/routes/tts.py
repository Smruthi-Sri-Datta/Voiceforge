from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from backend.services.tts_service import tts_service
from backend.database import get_db
from backend.models import Voice, Generation
from backend.routes.auth import get_current_user
import uuid
import os

router = APIRouter()

class GenerateRequest(BaseModel):
    text:     str
    speaker:  str = "Ana Florence"
    language: str = "en"
    speed:    float = 1.0
    voice_id: Optional[str] = None

@router.post("/generate")
def generate_audio(
    request: GenerateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    file_id     = str(uuid.uuid4())
    filename    = f"{file_id}.mp3"
    output_path = f"storage/outputs/{filename}"
    speaker_wav = None

    if request.voice_id:
        # Look up voice in DB to get file path
        voice = db.query(Voice).filter(
            Voice.id == request.voice_id,
            Voice.user_id == current_user.id
        ).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        speaker_wav = voice.file_path

    try:
        warning = tts_service.generate_audio(
            text=request.text,
            output_path=output_path,
            speaker=request.speaker,
            speaker_wav=speaker_wav,
            language=request.language,
            speed=request.speed
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    # Save generation to DB
    generation = Generation(
        id        = file_id,
        user_id   = current_user.id,
        text      = request.text[:200],  # store preview
        language  = request.language,
        speaker   = request.speaker,
        file_path = output_path,
    )
    db.add(generation)
    db.commit()

    return {
        "message": "Audio generated!",
        "file":    filename,
        "warning": warning
    }

@router.get("/voices")
def get_voices():
    return {"voices": tts_service.get_voices()}

@router.get("/languages")
def get_languages():
    return {"languages": tts_service.get_languages()}

@router.post("/clone-voice")
async def clone_voice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    voice_id  = str(uuid.uuid4())
    filename  = f"{voice_id}.wav"
    save_path = f"storage/outputs/{filename}"

    os.makedirs("storage/outputs", exist_ok=True)
    with open(save_path, "wb") as f:
        f.write(await file.read())

    # Count existing voices for auto-naming
    voice_count = db.query(Voice).filter(Voice.user_id == current_user.id).count()
    voice_name  = f"V{voice_count + 1}"

    # Save voice to DB
    voice = Voice(
        id        = voice_id,
        user_id   = current_user.id,
        name      = voice_name,
        file_path = save_path,
    )
    db.add(voice)
    db.commit()

    return {"voice_id": voice_id, "name": voice_name}

@router.get("/my-voices")
def get_my_voices(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    voices = db.query(Voice).filter(
        Voice.user_id == current_user.id
    ).order_by(Voice.created_at.desc()).all()

    valid_voices = []
    for v in voices:
        if os.path.exists(v.file_path):
            valid_voices.append({
                "voice_id":   v.id,
                "name":       v.name,
                "created_at": v.created_at.isoformat(),
            })
        else:
            # File gone (pod restarted) — clean up DB too
            db.delete(v)
    db.commit()

    return {"voices": valid_voices}

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
            "created_at": g.created_at.isoformat(),
        }
        for g in generations
    ]}

@router.get("/audio/{filename}")
def get_audio(filename: str):
    path = f"storage/outputs/{filename}"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path, media_type="audio/mpeg")