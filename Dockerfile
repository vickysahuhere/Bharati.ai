FROM python:3.12-slim

# Install system dependencies for OCR & PDF parsing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# Copy requirements from root or backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend/ /srv/

# Copy configuration
COPY config/ /config/

ENV DATA_DIR=/srv/data
ENV COLLEGE_CONFIG=/config/college.yaml
ENV PORT=8000

EXPOSE 8000

# Start FastAPI server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
