from TTS.api import TTS
import subprocess
import os

class TTSService:
    def __init__(self):
        print("Loading XTTS v2 model...")
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
        print("Model loaded!")

    def generate_audio(self, text: str, output_path: str, speaker: str = "Ana Florence", language: str = "en", speed: float = 1.0):
        self.tts.tts_to_file(
            text=text,
            speaker=speaker,
            language=language,
            file_path=output_path
        )
        # Apply speed using FFmpeg if not default
        if speed != 1.0:
            sped_up_path = output_path.replace(".wav", "_fast.wav")
            subprocess.run([
                "ffmpeg", "-i", output_path,
                "-filter:a", f"atempo={speed}",
                sped_up_path, "-y"
            ])
            os.replace(sped_up_path, output_path)
        return output_path

    def get_voices(self):
        return ["Ana Florence", "Claribel Dervla", "Daisy Studious", "Gracie Wise"]

    def get_languages(self):
        return [
            {"code": "en", "name": "English"},
            {"code": "hi", "name": "Hindi"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "es", "name": "Spanish"},
            {"code": "ja", "name": "Japanese"},
            {"code": "zh-cn", "name": "Chinese"},
        ]

tts_service = TTSService()