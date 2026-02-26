# Lightweight Python image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Pillow and other libs
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY main.py .
COPY model.tflite .
COPY labels.txt .
COPY calories.json .

# Cloud Run expects the app to listen on the port defined by $PORT
ENV PORT 8080

# Command to run the application
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
