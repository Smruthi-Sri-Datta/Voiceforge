from TTS.api import TTS
from langdetect import detect, LangDetectException
import subprocess
import requests
import base64
import os

# ── Language routing ───────────────────────────────────────────
SARVAM_LANGUAGES = {
    "hi": "hi-IN",
    "bn": "bn-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "pa": "pa-IN",
    "or": "or-IN",
}

XTTS_LANGUAGES = ["en", "fr", "de", "es", "ja", "zh-cn"]

LANG_NAMES = {
    "hi":    "Hindi",
    "bn":    "Bengali",
    "ta":    "Tamil",
    "te":    "Telugu",
    "gu":    "Gujarati",
    "kn":    "Kannada",
    "ml":    "Malayalam",
    "mr":    "Marathi",
    "pa":    "Punjabi",
    "or":    "Odia",
    "en":    "English",
    "fr":    "French",
    "de":    "German",
    "es":    "Spanish",
    "ja":    "Japanese",
    "zh-cn": "Chinese",
}

LANGDETECT_MAP = {
    "hi":    "hi",
    "bn":    "bn",
    "ta":    "ta",
    "te":    "te",
    "gu":    "gu",
    "kn":    "kn",
    "ml":    "ml",
    "mr":    "mr",
    "pa":    "pa",
    "or":    "or",
    "zh-cn": "zh-cn", "zh-tw": "zh-cn", "zh": "zh-cn",
    "ja":    "ja",
    "fr":    "fr",
    "de":    "de",
    "es":    "es",
    "en":    "en",
}

# Only Hindi has a real Romanized use case (Hinglish)
# All other Indian languages + Japanese + Chinese → hard block if Latin detected
ROMANIZED_WARN_ALLOWED = ["hi"]

# If langdetect returns one of these → real non-Latin script detected → genuine mismatch
NATIVE_SCRIPT_LANGS = ["hi", "bn", "ta", "te", "gu", "kn", "ml", "mr", "pa", "or",
                        "ja", "zh-cn", "zh-tw", "zh", "ar", "ko"]


class TTSService:
    def __init__(self):
        print("Loading XTTS v2 model...")
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
        self.sarvam_api_key = os.getenv("SARVAM_API_KEY")
        print("Model loaded!")

    # ── Main entry point ───────────────────────────────────────
    def generate_audio(
        self,
        text: str,
        output_path: str,
        speaker: str = "Ana Florence",
        speaker_wav: str = None,
        language: str = "en",
        speed: float = 1.0
    ):
        output_path = output_path.replace(".wav", ".mp3")

        if language in SARVAM_LANGUAGES:
            return self._generate_sarvam(text, output_path, language, speaker, speed)
        else:
            return self._generate_xtts(text, output_path, speaker, speaker_wav, language, speed)

    # ── Sarvam API (Indian languages) ─────────────────────────
    def _generate_sarvam(self, text, output_path, language, speaker, speed):
        if len(text) > 2500:
            raise ValueError(
                f"Indian language TTS supports up to 2,500 characters. "
                f"Your text is {len(text)} characters. Please shorten it."
            )

        # Check mismatch BEFORE calling Sarvam — block invalid input early
        warning_msg = self._check_language_mismatch(text, language)

        sarvam_lang_code = SARVAM_LANGUAGES[language]
        pace = max(0.3, min(3.0, speed))

        # Use passed speaker (lowercase) or fallback to anushka
        sarvam_speaker = speaker.lower() if speaker and not speaker.lower().startswith("v") else "anushka"

        try:
            response = requests.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={
                    "api-subscription-key": self.sarvam_api_key,
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
            # Extract Sarvam's error message if request fails
            if not response.ok:
                try:
                    err = response.json().get("error", {}).get("message", response.text)
                except Exception:
                    err = response.text
                raise ValueError(f"Audio generation failed: {err}")
            response.raise_for_status()

        except requests.exceptions.RequestException as e:
            raise ValueError(f"Audio generation failed: {str(e)}")

        data        = response.json()
        wav_path    = output_path.replace(".mp3", "_temp.wav")
        audio_bytes = base64.b64decode(data["audios"][0])
        with open(wav_path, "wb") as f:
            f.write(audio_bytes)

        self._convert_to_mp3(wav_path, output_path)
        os.remove(wav_path)

        return warning_msg

    # ── XTTS v2 (non-Indian languages) ────────────────────────
    def _generate_xtts(self, text, output_path, speaker, speaker_wav, language, speed):
        if len(text) > 5000:
            raise ValueError(
                f"Text exceeds 5,000 character limit. Your text is {len(text)} characters."
            )

        warning_msg = self._check_language_mismatch(text, language)
        wav_path    = output_path.replace(".mp3", "_temp.wav")

        try:
            if speaker_wav:
                if not os.path.exists(speaker_wav):
                    raise ValueError(f"Voice file not found: {speaker_wav}")
                self.tts.tts_to_file(
                    text=text, speaker_wav=speaker_wav,
                    language=language, file_path=wav_path
                )
            else:
                self.tts.tts_to_file(
                    text=text, speaker=speaker,
                    language=language, file_path=wav_path
                )
        except NotImplementedError:
            lang_name = LANG_NAMES.get(language, language)
            raise ValueError(
                f"Text language doesn't match selected language '{lang_name}'. "
                f"Please make sure your text is written in {lang_name}."
            )
        except Exception as e:
            raise ValueError(f"Audio generation failed: {str(e)}")

        if speed != 1.0:
            sped_path = wav_path.replace("_temp.wav", "_fast.wav")
            result = subprocess.run([
                "ffmpeg", "-i", wav_path,
                "-filter:a", f"atempo={speed}",
                sped_path, "-y"
            ], capture_output=True)
        if result.returncode != 0:
            raise ValueError(f"Audio conversion failed: {result.stderr.decode()}")
        if not os.path.exists(mp3_path) or os.path.getsize(mp3_path) == 0:
            raise ValueError("Audio conversion produced empty file")
            os.replace(sped_path, wav_path)

        self._convert_to_mp3(wav_path, output_path)
        os.remove(wav_path)

        return warning_msg

    # ── WAV → MP3 ──────────────────────────────────────────────
    def _convert_to_mp3(self, wav_path, mp3_path):
        result = subprocess.run([
            "ffmpeg", "-i", wav_path,
            "-codec:a", "libmp3lame",
            "-qscale:a", "2",
            mp3_path, "-y"
        ], capture_output=True)
        if result.returncode != 0:
            raise ValueError(f"Audio conversion failed: {result.stderr.decode()}")
        if not os.path.exists(mp3_path) or os.path.getsize(mp3_path) == 0:
            raise ValueError("Audio conversion produced empty file")

    # ── Language mismatch detection ────────────────────────────
    def _check_language_mismatch(self, text, language):
        try:
            detected_raw  = detect(text)
            detected_code = LANGDETECT_MAP.get(detected_raw, detected_raw)
        except LangDetectException:
            return None  # can't detect → trust user

        if detected_code == language:
            return None  # all good

        selected_name = LANG_NAMES.get(language, language)
        detected_name = LANG_NAMES.get(detected_code, detected_code)

        # Latin script detected but non-Latin language selected
        if detected_code not in NATIVE_SCRIPT_LANGS:
            if language in ROMANIZED_WARN_ALLOWED:
                # Hindi only → warn but allow (Hinglish use case)
                return (
                    f"Your text appears to be in Roman/Latin script. "
                    f"If this is Romanized {selected_name}, audio quality may vary. "
                    f"For best results, type in native {selected_name} script."
                )
            else:
                # All other Indian languages → hard block
                raise ValueError(
                    f"Text appears to be in Latin script but you selected {selected_name}. "
                    f"Please type your text in {selected_name} script."
                )
        else:
            # Detected a different native script → hard block
            raise ValueError(
                f"Text appears to be {detected_name} but you selected {selected_name}. "
                f"Please make sure your text is written in {selected_name}."
            )

    # ── Voice & language lists ─────────────────────────────────
    def get_voices(self):
        return ["Ana Florence", "Claribel Dervla", "Daisy Studious", "Gracie Wise"]

    def get_languages(self):
        return [
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

tts_service = TTSService()