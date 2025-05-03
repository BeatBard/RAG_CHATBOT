# RAG Chatbot with Memory

A Retrieval-Augmented Generation (RAG) chatbot system with conversation memory, document management, and intelligent text processing.

## Features

- **Smart Chunking** - Documents are split into smaller, strategic chunks (400 characters with 50-character overlap) for more precise retrieval
- **Conversation Memory** - Maintains a summary of the conversation for better context
- **Multiple Document Support** - Upload and switch between different documents
- **Context-Aware Responses** - Considers both document content and conversation history when answering
- **Memory Management** - Ability to view, reset, and maintain conversation memory
- **Optimized Retrieval** - Uses similarity search to find only the most relevant information (top 3 chunks)
- **Error Handling** - Gracefully handles API rate limiting, missing files, and other errors
- **Off-Topic Question Handling** - Properly identifies when it can't answer based on available knowledge

## Architecture

- **Frontend**: Next.js React application
- **Backend**: FastAPI server with LangChain RAG implementation
- **Models**: Mistral AI for both embeddings and language model

## Getting Started

### Prerequisites

- Python 3.9+ for the backend
- Node.js 18+ for the frontend
- Mistral API key

### Setup and Installation

1. Clone the repository

2. Setup the backend:
   ```bash
   cd rag-system/backend
   pip install -r requirements.txt
   # Create a .env file with your MISTRAL_API_KEY
   echo "MISTRAL_API_KEY=your-api-key-here" > .env
   ```

3. Setup the frontend:
   ```bash
   cd rag-system/frontend
   npm install
   ```

4. Running the application:
   ```bash
   # Terminal 1 - Backend
   cd rag-system/backend
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   
   # Terminal 2 - Frontend
   cd rag-system/frontend
   npm run dev
   ```

5. Access the application at `http://localhost:3000`

## Document Management

The system allows you to:
- Upload new .txt or .md documents
- Switch between different documents (automatically resets conversation memory)
- View the active document being used for answering questions

## Memory Management

The system provides robust conversation memory features:
- View the current conversation summary and history
- Reset memory when needed (automatically happens when switching documents)
- Debug conversation memory state
- Memory persists between sessions

## Implementation Details

- RAG implementation uses LangChain with Mistral AI
- Document processing includes advanced text splitting strategies
- Conversation memory uses ConversationSummaryMemory for efficient history tracking
- API calls include automatic retry with exponential backoff for rate limit handling
- Custom prompt engineering to ensure context awareness 