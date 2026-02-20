from TTS.api import TTS

class TTSService:
    def __init__(self):
        print("Loading XTTS v2 model...")
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
        print("Model loaded!")

    def generate_audio(self, text: str, output_path: str, speaker: str = "Ana Florence", language: str = "en"):
        self.tts.tts_to_file(
            text=text,
            speaker=speaker,
            language=language,
            file_path=output_path
        )
        return output_path

tts_service = TTSService()