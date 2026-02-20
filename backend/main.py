from fastapi import FastAPI
from backend.routes.tts import router as tts_router

app = FastAPI(title="VoiceForge API")

app.include_router(tts_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "VoiceForge API is running!"}