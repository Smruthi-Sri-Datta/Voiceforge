"""
VoiceForge — RunPod Serverless Handler
Handles all TTS/AI inference jobs. Zero auth logic — Railway handles that.
"""

import runpod
import os
import uuid
import base64
import subprocess
import requests
import tempfile
from dotenv import load_dotenv
# Monkey-patch missing function removed in newer transformers
import transformers.pytorch_utils as _torch_utils
if not hasattr(_torch_utils, 'isin_mps_friendly'):
    import torch
    _torch_utils.isin_mps_friendly = torch.isin

load_dotenv()

# ── Constants ──────────────────────────────────────────────────────────────────
MODEL_CACHE_PATH  = "/runpod-volume/models/xtts_v2"
SUPABASE_URL      = os.getenv("SUPABASE_URL")
SUPABASE_KEY      = os.getenv("SUPABASE_SERVICE_KEY")
SARVAM_API_KEY    = os.getenv("SARVAM_API_KEY")

# ── Language routing (same as tts_service.py) ──────────────────────────────────
SARVAM_LANGUAGES = {
    "hi": "hi-IN", "bn": "bn-IN", "ta": "ta-IN", "te": "te-IN",
    "gu": "gu-IN", "kn": "kn-IN", "ml": "ml-IN", "mr": "mr-IN",
    "pa": "pa-IN", "or": "od-IN",
}

XTTS_LANGUAGES = ["en", "fr", "de", "es", "ja", "zh-cn"]

LANG_NAMES = {
    "hi": "Hindi",    "bn": "Bengali",   "ta": "Tamil",
    "te": "Telugu",   "gu": "Gujarati",  "kn": "Kannada",
    "ml": "Malayalam","mr": "Marathi",   "pa": "Punjabi",
    "or": "Odia",     "en": "English",   "fr": "French",
    "de": "German",   "es": "Spanish",   "ja": "Japanese",
    "zh-cn": "Chinese",
}

VOICES = ["Ana Florence", "Claribel Dervla", "Daisy Studious", "Gracie Wise"]

LANGUAGES = [
    {"code": "en",    "name": "🇬🇧 English",   "engine": "xtts"},
    {"code": "fr",    "name": "🇫🇷 French",    "engine": "xtts"},
    {"code": "de",    "name": "🇩🇪 German",    "engine": "xtts"},
    {"code": "es",    "name": "🇪🇸 Spanish",   "engine": "xtts"},
    {"code": "ja",    "name": "🇯🇵 Japanese",  "engine": "xtts"},
    {"code": "zh-cn", "name": "🇨🇳 Chinese",   "engine": "xtts"},
    {"code": "hi",    "name": "🇮🇳 Hindi",     "engine": "sarvam"},
    {"code": "bn",    "name": "🇮🇳 Bengali",   "engine": "sarvam"},
    {"code": "ta",    "name": "🇮🇳 Tamil",     "engine": "sarvam"},
    {"code": "te",    "name": "🇮🇳 Telugu",    "engine": "sarvam"},
    {"code": "gu",    "name": "🇮🇳 Gujarati",  "engine": "sarvam"},
    {"code": "kn",    "name": "🇮🇳 Kannada",   "engine": "sarvam"},
    {"code": "ml",    "name": "🇮🇳 Malayalam", "engine": "sarvam"},
    {"code": "mr",    "name": "🇮🇳 Marathi",   "engine": "sarvam"},
    {"code": "pa",    "name": "🇮🇳 Punjabi",   "engine": "sarvam"},
    {"code": "or",    "name": "🇮🇳 Odia",      "engine": "sarvam"},
]

# ── Global model (loaded once per container lifetime) ──────────────────────────
tts_model = None


def load_model():
    """Load XTTS v2 — from network volume cache if available, else download."""
    global tts_model
    if tts_model is not None:
        print("Model already loaded in memory, reusing.")
        return tts_model

    from TTS.api import TTS

    config_file = os.path.join(MODEL_CACHE_PATH, "config.json")

    if os.path.exists(config_file):
        print(f"Loading XTTS v2 from network volume cache: {MODEL_CACHE_PATH}")
        tts_model = TTS(model_path=MODEL_CACHE_PATH,
                        config_path=config_file).to("cuda")
        print("Model loaded from cache!")
    else:
        print("Cache miss — downloading XTTS v2 from HuggingFace (first time only)...")
        os.makedirs(MODEL_CACHE_PATH, exist_ok=True)
        tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
        # Save to network volume for future cold starts
        try:
            model_dir = os.path.expanduser("~/.local/share/tts/tts_models--multilingual--multi-dataset--xtts_v2")
            if os.path.exists(model_dir):
                import shutil
                shutil.copytree(model_dir, MODEL_CACHE_PATH, dirs_exist_ok=True)
                print(f"Model cached to {MODEL_CACHE_PATH} for future cold starts.")
        except Exception as e:
            print(f"Warning: Could not cache model to network volume: {e}")
            print("Model will re-download on next cold start.")

    return tts_model


# ── Supabase Storage ───────────────────────────────────────────────────────────
def upload_to_supabase(local_path: str, bucket: str, filename: str) -> str:
    """Upload file to Supabase Storage and return public URL."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "audio/wav" if filename.endswith(".wav") else "audio/mpeg",
    }
    with open(local_path, "rb") as f:
        data = f.read()

    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{filename}"
    response = requests.post(url, headers=headers, data=data)

    if response.status_code not in (200, 201):
        raise Exception(f"Supabase upload failed: {response.text}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"
    return public_url


# ── Audio conversion ───────────────────────────────────────────────────────────
def convert_to_mp3(wav_path: str, mp3_path: str):
    subprocess.run([
        "ffmpeg", "-i", wav_path,
        "-codec:a", "libmp3lame",
        "-qscale:a", "2",
        mp3_path, "-y"
    ], capture_output=True, check=True)


def apply_speed(wav_path: str, speed: float) -> str:
    """Apply speed adjustment to WAV, returns new path."""
    if speed == 1.0:
        return wav_path
    sped_path = wav_path.replace(".wav", "_fast.wav")
    subprocess.run([
        "ffmpeg", "-i", wav_path,
        "-filter:a", f"atempo={speed}",
        sped_path, "-y"
    ], capture_output=True, check=True)
    os.remove(wav_path)
    return sped_path


# ── Language mismatch detection ────────────────────────────────────────────────
LANGDETECT_MAP = {
    "hi": "hi", "bn": "bn", "ta": "ta", "te": "te", "gu": "gu",
    "kn": "kn", "ml": "ml", "mr": "mr", "pa": "pa", "or": "or",
    "zh-cn": "zh-cn", "zh-tw": "zh-cn", "zh": "zh-cn",
    "ja": "ja", "fr": "fr", "de": "de", "es": "es", "en": "en",
}
ROMANIZED_WARN_ALLOWED = ["hi"]
NATIVE_SCRIPT_LANGS = [
    "hi", "bn", "ta", "te", "gu", "kn", "ml", "mr", "pa", "or",
    "ja", "zh-cn", "zh-tw", "zh", "ar", "ko"
]

def check_language_mismatch(text: str, language: str):
    try:
        from langdetect import detect, LangDetectException
        detected_raw  = detect(text)
        detected_code = LANGDETECT_MAP.get(detected_raw, detected_raw)
    except Exception:
        return None

    if detected_code == language:
        return None

    selected_name = LANG_NAMES.get(language, language)
    detected_name = LANG_NAMES.get(detected_code, detected_code)

    if detected_code not in NATIVE_SCRIPT_LANGS:
        if language in ROMANIZED_WARN_ALLOWED:
            return (
                f"Your text appears to be in Roman/Latin script. "
                f"For best results, type in native {selected_name} script."
            )
        else:
            raise ValueError(
                f"Text appears to be in Latin script but you selected {selected_name}. "
                f"Please type your text in {selected_name} script."
            )
    else:
        raise ValueError(
            f"Text appears to be {detected_name} but you selected {selected_name}. "
            f"Please make sure your text is written in {selected_name}."
        )


# ── Action Handlers ────────────────────────────────────────────────────────────

def handle_get_languages():
    return {"languages": LANGUAGES}


def handle_get_voices():
    return {"voices": VOICES}


def handle_generate(inp: dict) -> dict:
    """Generate TTS audio. Routes to XTTS or Sarvam based on language."""
    text       = inp.get("text", "")
    language   = inp.get("language", "en")
    speaker    = inp.get("speaker", "Ana Florence")
    speed      = float(inp.get("speed", 1.0))
    voice_wav  = inp.get("voice_wav_base64")   # base64-encoded WAV for voice cloning
    file_id    = str(uuid.uuid4())
    filename   = f"{file_id}.mp3"

    with tempfile.TemporaryDirectory() as tmpdir:
        output_mp3  = os.path.join(tmpdir, filename)
        speaker_wav = None

        # If voice cloning — decode base64 WAV
        if voice_wav:
            speaker_wav = os.path.join(tmpdir, "speaker.wav")
            with open(speaker_wav, "wb") as f:
                f.write(base64.b64decode(voice_wav))

        if language in SARVAM_LANGUAGES:
            warning = _generate_sarvam(
                text, output_mp3, language, speaker, speed, tmpdir
            )
        else:
            warning = _generate_xtts(
                text, output_mp3, speaker, speaker_wav, language, speed, tmpdir
            )

        # Upload to Supabase Storage
        public_url = upload_to_supabase(output_mp3, "audio", filename)

    return {
        "file_id":   file_id,
        "filename":  filename,
        "audio_url": public_url,
        "warning":   warning,
    }


def _generate_sarvam(text, output_mp3, language, speaker, speed, tmpdir):
    if len(text) > 2500:
        raise ValueError(
            f"Indian language TTS supports up to 2,500 characters. "
            f"Your text is {len(text)} characters. Please shorten it."
        )

    warning = check_language_mismatch(text, language)
    sarvam_lang_code = SARVAM_LANGUAGES[language]
    pace = max(0.3, min(3.0, speed))
    sarvam_speaker = (
        speaker.lower()
        if speaker and not speaker.lower().startswith("v")
        else "anushka"
    )

    response = requests.post(
        "https://api.sarvam.ai/text-to-speech",
        headers={
            "api-subscription-key": SARVAM_API_KEY,
            "Content-Type": "application/json"
        },
        json={
            "inputs":               [text],
            "target_language_code": sarvam_lang_code,
            "speaker":              sarvam_speaker,
            "model":                "bulbul:v2",
            "pace":                 pace,
            "enable_preprocessing": True,
        }
    )

    if not response.ok:
        try:
            err = response.json().get("error", {}).get("message", response.text)
        except Exception:
            err = response.text
        raise ValueError(f"Audio generation failed: {err}")

    data     = response.json()
    wav_path = os.path.join(tmpdir, "sarvam_temp.wav")
    with open(wav_path, "wb") as f:
        f.write(base64.b64decode(data["audios"][0]))

    convert_to_mp3(wav_path, output_mp3)
    return warning


def _generate_xtts(text, output_mp3, speaker, speaker_wav, language, speed, tmpdir):
    if len(text) > 5000:
        raise ValueError(
            f"Text exceeds 5,000 character limit. "
            f"Your text is {len(text)} characters."
        )

    warning  = check_language_mismatch(text, language)
    wav_path = os.path.join(tmpdir, "xtts_temp.wav")
    tts      = load_model()

    try:
        if speaker_wav:
            if not os.path.exists(speaker_wav):
                raise ValueError("Voice file not found.")
            tts.tts_to_file(
                text=text, speaker_wav=speaker_wav,
                language=language, file_path=wav_path
            )
        else:
            tts.tts_to_file(
                text=text, speaker=speaker,
                language=language, file_path=wav_path
            )
    except NotImplementedError:
        lang_name = LANG_NAMES.get(language, language)
        raise ValueError(
            f"Text language doesn't match selected language '{lang_name}'. "
            f"Please make sure your text is written in {lang_name}."
        )

    wav_path = apply_speed(wav_path, speed)
    convert_to_mp3(wav_path, output_mp3)
    return warning


def handle_clone_voice(inp: dict) -> dict:
    """
    Receive base64-encoded WAV, upload to Supabase Storage.
    Railway will save the DB record — handler just stores the file.
    """
    voice_wav_b64 = inp.get("voice_wav_base64")
    voice_id      = inp.get("voice_id", str(uuid.uuid4()))

    if not voice_wav_b64:
        raise ValueError("voice_wav_base64 is required")

    filename = f"{voice_id}.wav"

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = os.path.join(tmpdir, filename)
        with open(wav_path, "wb") as f:
            f.write(base64.b64decode(voice_wav_b64))

        public_url = upload_to_supabase(wav_path, "voices", filename)

    return {
        "voice_id":  voice_id,
        "audio_url": public_url,
    }


# ── Main Handler ───────────────────────────────────────────────────────────────
def handler(job):
    """
    RunPod Serverless entry point.
    All requests come through here — routed by 'action' field.
    """
    try:
        inp    = job.get("input", {})
        action = inp.get("action")

        if action == "generate":
            return handle_generate(inp)

        elif action == "clone_voice":
            return handle_clone_voice(inp)

        elif action == "get_languages":
            return handle_get_languages()

        elif action == "get_voices":
            return handle_get_voices()

        else:
            return {"error": f"Unknown action: '{action}'. Valid: generate, clone_voice, get_languages, get_voices"}

    except ValueError as e:
        # User-facing errors (bad input, language mismatch, etc.)
        return {"error": str(e)}

    except Exception as e:
        # Unexpected server errors
        print(f"Unexpected error in handler: {e}")
        return {"error": f"Internal server error: {str(e)}"}

# ── Entrypoint ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Starting RunPod Serverless worker...")
    print("Model will load on first generate request.")
    runpod.serverless.start({"handler": handler})