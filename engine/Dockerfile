FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY tajweed_engine ./tajweed_engine
COPY train.py ./train.py
ENV IJAZAH_ENGINE_HOST=0.0.0.0 IJAZAH_ENGINE_PORT=8080
EXPOSE 8080
CMD ["uvicorn", "tajweed_engine.api:app", "--host", "0.0.0.0", "--port", "8080"]
