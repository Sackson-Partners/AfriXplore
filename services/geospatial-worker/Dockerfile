FROM python:3.12-slim

WORKDIR /app

# Install system deps for psycopg2 and PostGIS support
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY src/ ./src/

# Non-root user
RUN useradd -r -u 1001 appuser && chown -R appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

CMD ["python", "src/main.py"]
