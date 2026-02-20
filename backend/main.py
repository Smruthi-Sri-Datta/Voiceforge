from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.tts import router as tts_router

app = FastAPI(title="VoiceForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tts_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "VoiceForge API is running!"}