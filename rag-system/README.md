# 🤖 RAG Chatbot with Memory

A modern, intelligent Retrieval-Augmented Generation (RAG) chatbot system with conversation memory, document management, and advanced text processing capabilities.

![RAG Chatbot Demo](https://i.imgur.com/example.png)

## ✨ Features

### Core Features
- **Smart Document Processing**
  - Intelligent text chunking (400 characters with 50-character overlap)
  - Support for multiple document formats (.txt, .md)
  - Automatic document switching with memory reset
  - Document management interface

- **Advanced Conversation Management**
  - Persistent conversation memory
  - Context-aware responses
  - Conversation history tracking
  - Memory summary generation
  - Easy memory reset functionality

- **Enhanced Retrieval System**
  - Optimized similarity search
  - Top-3 most relevant chunk retrieval
  - Context-aware answer generation
  - Off-topic question detection

### Technical Features
- **Robust Error Handling**
  - API rate limit management
  - Graceful error recovery
  - User-friendly error messages
  - Automatic retry mechanisms

- **Modern UI/UX**
  - Responsive design
  - Real-time status updates
  - Intuitive document management
  - Clean and modern interface
  - Dark/light mode support

## 🏗️ Architecture

### Frontend
- **Framework**: Next.js 14 with React
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **API Integration**: Fetch API with error handling

### Backend
- **Framework**: FastAPI
- **RAG Implementation**: LangChain
- **Language Model**: Mistral AI
- **Vector Store**: FAISS

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose (recommended)
- OR
- Python 3.9+
- Node.js 18+
- Mistral API key

### Quick Start with Docker

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rag-system.git
   cd rag-system
   ```

2. Create environment file:
   ```bash
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

3. Access the application at `http://localhost:3000`

## 📚 Usage Guide

### Document Management
1. Click "Upload Document" to add new documents
2. Select a document from the sidebar to make it active
3. The system will automatically reset memory when switching documents

### Chat Interface
1. Type your question in the input field
2. Press Enter or click Send
3. View the response in the chat window
4. Use the debug panel to monitor system state

### Memory Management
- View conversation history in the chat window
- Reset memory using the reset button
- Monitor memory attributes in the debug panel

## 🔧 Configuration

### Environment Variables
- `MISTRAL_API_KEY`: Your Mistral AI API key
- `CHUNK_SIZE`: Document chunk size (default: 400)
- `CHUNK_OVERLAP`: Chunk overlap size (default: 50)
- `TOP_K`: Number of chunks to retrieve (default: 3)

### Docker Configuration
The system uses two services:
- Backend: FastAPI server (port 8000)
- Frontend: Next.js application (port 3000)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Mistral AI for the language model
- LangChain for the RAG implementation
- Next.js team for the frontend framework
- FastAPI team for the backend framework 