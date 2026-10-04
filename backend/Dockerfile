FROM python:3.12-slim

# Install system dependencies for OCR & PDF parsing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# Copy requirements from root or backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Pre-cache lightweight 384-dim embedding model to /srv/models_cache with 777 permissions
ENV FASTEMBED_CACHE_PATH=/srv/models_cache
ENV HF_HOME=/srv/models_cache
RUN mkdir -p /srv/models_cache && \
    python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5', cache_dir='/srv/models_cache', threads=1)" && \
    chmod -R 777 /srv/models_cache

# Copy backend application source directly into /srv
COPY backend/ /srv/

# Copy configuration
COPY config/ /config/

# Copy built frontend SPA
COPY frontend/dist/ /frontend/dist/

ENV DATA_DIR=/srv/data
ENV COLLEGE_CONFIG=/config/college.yaml
ENV FASTEMBED_CACHE_DIR=/srv/models_cache
ENV PORT=8000

EXPOSE 8000

# Start FastAPI server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
