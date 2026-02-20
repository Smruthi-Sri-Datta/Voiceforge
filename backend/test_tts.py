from TTS.api import TTS

# Initialize XTTS v2 model on GPU
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")

# Generate audio using built-in speaker
tts.tts_to_file(
    text="Hello! I am VoiceForge, your AI voice platform.",
    speaker="Ana Florence",
    language="en",
    #file_path="output.wav"
    file_path="storage/outputs/output.wav"
)

print("Audio generated successfully!")
