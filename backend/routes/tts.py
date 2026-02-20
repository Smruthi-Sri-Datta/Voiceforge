from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.tts_service import tts_service
import uuid
import os

router = APIRouter()

class GenerateRequest(BaseModel):
    text: str
    speaker: str = "Ana Florence"
    language: str = "en"

@router.post("/generate")
def generate_audio(request: GenerateRequest):
    filename = f"{uuid.uuid4()}.wav"
    output_path = f"storage/outputs/{filename}"
    
    tts_service.generate_audio(
        text=request.text,
        output_path=output_path,
        speaker=request.speaker,
        language=request.language
    )
    
    return {"message": "Audio generated!", "file": filename}