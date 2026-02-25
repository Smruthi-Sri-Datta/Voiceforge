from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from backend.services.tts_service import tts_service
from backend.database import get_db
from backend.models import Voice, Generation
from backend.routes.auth import get_current_user
from supabase import create_client
import uuid
import os

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_to_supabase(local_path: str, bucket: str, filename: str) -> str:
    """Upload file to Supabase Storage and return public URL."""
    with open(local_path, "rb") as f:
        data = f.read()
    content_type = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
    supabase.storage.from_(bucket).upload(filename, data, {"content-type": content_type})
    url = supabase.storage.from_(bucket).get_public_url(filename)
    return url

def delete_from_supabase(bucket: str, filename: str):
    """Delete file from Supabase Storage."""
    try:
        supabase.storage.from_(bucket).remove([filename])
    except Exception as e:
        print(f"Failed to delete from Supabase Storage: {e}")

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
        voice = db.query(Voice).filter(
            Voice.id == request.voice_id,
            Voice.user_id == current_user.id
        ).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        # Download voice file from Supabase if not local
        if not os.path.exists(voice.file_path):
            try:
                wav_filename = f"{voice.id}.wav"
                data = supabase.storage.from_("voices").download(wav_filename)
                os.makedirs("storage/outputs", exist_ok=True)
                with open(voice.file_path, "wb") as f:
                    f.write(data)
            except Exception as e:
                raise HTTPException(status_code=404, detail="Voice file not available")
        speaker_wav = voice.file_path

    try:
        os.makedirs("storage/outputs", exist_ok=True)
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

    # Upload to Supabase Storage
    try:
        public_url = upload_to_supabase(output_path, "audio", filename)
    except Exception as e:
        print(f"Supabase upload failed: {e}")
        public_url = None

    # Save generation to DB
    generation = Generation(
        id        = file_id,
        user_id   = current_user.id,
        text      = request.text[:200],
        language  = request.language,
        speaker   = request.speaker,
        file_path = output_path,
        audio_url = public_url,
    )
    db.add(generation)
    db.commit()

    return {
        "message":   "Audio generated!",
        "file":      filename,
        "audio_url": public_url,
        "warning":   warning
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
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    # Upload to Supabase Storage
    try:
        public_url = upload_to_supabase(save_path, "voices", filename)
    except Exception as e:
        print(f"Supabase upload failed: {e}")
        public_url = None

    # Count existing voices for auto-naming
    voice_count = db.query(Voice).filter(Voice.user_id == current_user.id).count()
    voice_name  = f"V{voice_count + 1}"

    voice = Voice(
        id        = voice_id,
        user_id   = current_user.id,
        name      = voice_name,
        file_path = save_path,
        audio_url = public_url,
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
        if os.path.exists(v.file_path) or v.audio_url:
            valid_voices.append({
                "voice_id":   v.id,
                "name":       v.name,
                "audio_url":  v.audio_url,
                "created_at": v.created_at.isoformat(),
            })
        else:
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
    if os.path.exists(voice.file_path):
        os.remove(voice.file_path)
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
    if os.path.exists(generation.file_path):
        os.remove(generation.file_path)
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
        if os.path.exists(g.file_path):
            os.remove(g.file_path)
        delete_from_supabase("audio", f"{g.id}.mp3")
        db.delete(g)
    db.commit()
    return {"message": "History cleared"}

@router.get("/audio/{filename}")
def get_audio(filename: str):
    path = f"storage/outputs/{filename}"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio not found")
    media_type = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
    return FileResponse(path, media_type=media_type)