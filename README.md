# 🤖 RAG Chatbot with Memory

A modern, intelligent Retrieval-Augmented Generation (RAG) chatbot system with conversation memory, document management, and advanced text processing capabilities.

## 🎬 Demo Video


https://github.com/user-attachments/assets/93a29be4-5d9d-4350-8a4f-ed80c82be29f



## ✨ Key Features

- Smart Document Processing (TXT, MD, PDF support)
- Advanced Conversation Management with Memory
- Enhanced Retrieval System with context-aware responses
- Robust Error Handling with rate limit management
- Modern UI/UX with responsive design

## 🏗️ Architecture

- **Frontend**: Next.js 14 with React, Tailwind CSS
- **Backend**: FastAPI, LangChain, Mistral AI, FAISS Vector Store
- **Memory**: ConversationSummaryMemory for persistent chat context

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose (recommended)
- OR Python 3.9+ and Node.js 18+
- Mistral API key

### Quick Start with Docker

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rag-system.git
   cd rag-system
   ```

2. Create environment file:
   ```bash
   # Create .env file with your Mistral API key
   echo "MISTRAL_API_KEY=your-api-key-here" > .env
   ```

3. Start the application:
   ```bash
   docker-compose up --build
   ```

4. Access the application at `http://localhost:3000`

### Manual Setup

1. Backend Setup:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   echo "MISTRAL_API_KEY=your-api-key-here" > .env
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. Frontend Setup:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 📚 Usage Guide

1. **Upload documents** using the upload button
2. **Select a document** from the sidebar to make it active
3. **Ask questions** in the chat interface
4. **View responses** based on the document content
5. Use the **debug panel** to monitor system state and reset memory if needed

## 🔧 Configuration

- `MISTRAL_API_KEY`: Your Mistral AI API key
- `CHUNK_SIZE`: Document chunk size (default: 400)
- `CHUNK_OVERLAP`: Chunk overlap size (default: 50)
- `TOP_K`: Number of chunks to retrieve (default: 3)

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 🙏 Acknowledgments

- Mistral AI for the language model
- LangChain for the RAG implementation
- Next.js team for the frontend framework
- FastAPI team for the backend framework 
