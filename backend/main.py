from dotenv import load_dotenv
load_dotenv()  # Must be first — loads .env before anything reads os.getenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import engine
from backend import models
from backend.routes.tts import router as tts_router
from backend.routes.auth import router as auth_router

# Create all DB tables on startup (safe to call multiple times)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="VoiceForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
           "http://localhost:5174",
           "https://voiceforge-gamma.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tts_router,  prefix="/api")
app.include_router(auth_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "VoiceForge API is running!"}
