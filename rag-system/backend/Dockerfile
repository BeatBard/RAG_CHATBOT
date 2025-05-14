# Use an official Python image
FROM python:3.10-slim

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    python3-dev \
    build-essential \
    libpoppler-cpp-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set pip configuration to handle timeouts
ENV PIP_DEFAULT_TIMEOUT=300
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1

# Install Python dependencies with retries
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --retries 10 --timeout 300 -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/uploads /app/vectorstore

# Copy the rest of the code
COPY . .

# Copy the entrypoint script and make it executable
COPY entrypoint.sh .
RUN chmod +x /app/entrypoint.sh

# Expose FastAPI port
EXPOSE 8000

# Run the entrypoint script
CMD ["/app/entrypoint.sh"]
