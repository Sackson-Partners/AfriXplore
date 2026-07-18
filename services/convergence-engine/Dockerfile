FROM python:3.11-slim
WORKDIR /app
COPY services/convergence-engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/convergence-engine/src/ ./src/
COPY services/convergence-engine/.env.example .env
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3005"]
