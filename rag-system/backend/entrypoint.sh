#!/bin/bash
set -e

# Install PDF processing dependencies
echo "Installing PDF processing dependencies..."
pip install --no-cache-dir pypdf unstructured unstructured-inference

# Create necessary directories
mkdir -p /app/uploads /app/vectorstore

# Run the application
echo "Starting the RAG Chatbot backend..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload 