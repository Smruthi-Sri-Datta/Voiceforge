from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from backend.services.tts_service import tts_service
import uuid
import os

router = APIRouter()

class GenerateRequest(BaseModel):
    text: str
    speaker: str = "Ana Florence"
    language: str = "en"
    speed: float = 1.0

@router.post("/generate")
def generate_audio(request: GenerateRequest):
    filename = f"{uuid.uuid4()}.wav"
    output_path = f"storage/outputs/{filename}"
    tts_service.generate_audio(
        text=request.text,
        output_path=output_path,
        speaker=request.speaker,
        language=request.language,
        speed=request.speed
    )
    return {"message": "Audio generated!", "file": filename}

@router.get("/voices")
def get_voices():
    return {"voices": tts_service.get_voices()}

@router.get("/languages")
def get_languages():
    return {"languages": tts_service.get_languages()}

@router.post("/clone-voice")
async def clone_voice(file: UploadFile = File(...)):
    voice_id = f"{uuid.uuid4()}.wav"
    save_path = f"storage/outputs/{voice_id}"
    with open(save_path, "wb") as f:
        f.write(await file.read())
    return {"voice_id": voice_id}

@router.get("/audio/{file_id}")
def get_audio(file_id: str):
    file_path = f"storage/outputs/{file_id}"
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    return FileResponse(file_path, media_type="audio/wav")