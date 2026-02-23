from TTS.api import TTS
from langdetect import detect, LangDetectException
import subprocess
import os

class TTSService:
    def __init__(self):
        print("Loading XTTS v2 model...")
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
        print("Model loaded!")

    def generate_audio(
        self,
        text: str,
        output_path: str,
        speaker: str = "Ana Florence",
        speaker_wav: str = None,
        language: str = "en",
        speed: float = 1.0
    ):
        # ── Language names ─────────────────────────────────────
        LANG_NAMES = {
            "hi":    "Hindi",
            "zh-cn": "Chinese",
            "ja":    "Japanese",
            "fr":    "French",
            "de":    "German",
            "es":    "Spanish",
            "en":    "English"
        }

        # Map langdetect codes → our codes
        LANGDETECT_MAP = {
            "hi":    "hi",
            "zh-cn": "zh-cn", "zh-tw": "zh-cn", "zh": "zh-cn",
            "ja":    "ja",
            "fr":    "fr",
            "de":    "de",
            "es":    "es",
            "en":    "en",
        }

        # Languages that use non-Latin native scripts
        # If selected language is one of these but text looks Latin → possibly Romanized
        ROMAN_SCRIPT_POSSIBLE = ["hi", "ja", "zh-cn"]

        # If langdetect returns one of these, it means real non-Latin script was detected
        # so it's a genuine mismatch, not Romanized
        NATIVE_SCRIPT_LANGS = ["hi", "ja", "zh-cn", "zh-tw", "zh", "ar", "ko"]

        # ── Detect language of input text ──────────────────────
        try:
            detected_raw  = detect(text)
            detected_code = LANGDETECT_MAP.get(detected_raw, detected_raw)
        except LangDetectException:
            detected_code = language  # can't detect → trust user selection

        # ── Validate or warn ───────────────────────────────────
        warning_msg = None

        if detected_code != language:
            selected_name = LANG_NAMES.get(language, language)
            detected_name = LANG_NAMES.get(detected_code, detected_code)

            if language in ROMAN_SCRIPT_POSSIBLE and detected_code not in NATIVE_SCRIPT_LANGS:
                # Likely Romanized (e.g. Hinglish, Romaji) — generate but warn
                warning_msg = (
                    f"Your text appears to be in Roman/Latin script. "
                    f"If this is Romanized {selected_name}, audio quality may vary. "
                    f"For best results, type in native {selected_name} script."
                )
            else:
                # Clear mismatch — hard block
                raise ValueError(
                    f"Text appears to be {detected_name} but you selected {selected_name}. "
                    f"Please make sure your text is written in {selected_name}."
                )

        # ── Generate audio ─────────────────────────────────────
        try:
            if speaker_wav:
                if not os.path.exists(speaker_wav):
                    raise ValueError(f"Voice file not found: {speaker_wav}")
                self.tts.tts_to_file(
                    text=text,
                    speaker_wav=speaker_wav,
                    language=language,
                    file_path=output_path
                )
            else:
                self.tts.tts_to_file(
                    text=text,
                    speaker=speaker,
                    language=language,
                    file_path=output_path
                )
        except NotImplementedError:
            lang_name = LANG_NAMES.get(language, language)
            raise ValueError(
                f"Text language doesn't match selected language '{lang_name}'. "
                f"Please make sure your text is written in {lang_name}."
            )
        except Exception as e:
            raise ValueError(f"Audio generation failed: {str(e)}")

        # ── Apply speed ────────────────────────────────────────
        if speed != 1.0:
            sped_up_path = output_path.replace(".wav", "_fast.wav")
            subprocess.run([
                "ffmpeg", "-i", output_path,
                "-filter:a", f"atempo={speed}",
                sped_up_path, "-y"
            ])
            os.replace(sped_up_path, output_path)

        return warning_msg  # None = no warning, string = show warning on frontend

    def get_voices(self):
        return ["Ana Florence", "Claribel Dervla", "Daisy Studious", "Gracie Wise"]

    def get_languages(self):
        return [
            {"code": "en",    "name": "English"},
            {"code": "hi",    "name": "Hindi"},
            {"code": "fr",    "name": "French"},
            {"code": "de",    "name": "German"},
            {"code": "es",    "name": "Spanish"},
            {"code": "ja",    "name": "Japanese"},
            {"code": "zh-cn", "name": "Chinese"},
        ]

tts_service = TTSService()