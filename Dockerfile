# VoiceForge — RunPod Serverless TTS Container
# Base image: PyTorch 2.4.0 + Python 3.11 + CUDA 12.4.1
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

# Accept XTTS license non-interactively
ENV COQUI_TOS_AGREED=1
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        git \
        curl \
        build-essential \
        mecab \
        libmecab-dev \
        mecab-ipadic-utf8 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /usr/local/etc \
    && ln -s /etc/mecabrc /usr/local/etc/mecabrc

# Set working directory
WORKDIR /app

# Copy only what the handler needs (lean image)
COPY requirements-runpod.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-runpod.txt

# Copy handler and TTS service
COPY handler.py .
COPY backend/services/tts_service.py ./backend/services/tts_service.py
COPY backend/__init__.py ./backend/__init__.py
COPY backend/services/__init__.py ./backend/services/__init__.py

# RunPod Serverless entrypoint
CMD ["python", "-u", "handler.py"]