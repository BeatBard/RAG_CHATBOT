# main.py ────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_chain import get_rag_chain, invoke_with_retry
import logging
import os
import shutil
from typing import List


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# ── CORS: allow everything while you're developing ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
active_document = "essay.txt"  # Default document

# Build the RAG‑with‑summary chain once at startup
rag_chain = get_rag_chain(document_path=active_document)


# Request body model  (frontend still sends {"input": "..."} )
class Query(BaseModel):
    input: str


# Document info response
class DocumentInfo(BaseModel):
    filename: str
    size: int
    active: bool


# Health‑check route
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Server is running"}


# Upload a new document
@app.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document to be used for RAG"""
    global rag_chain
    global active_document
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Only allow text files
    if not file.filename.endswith((".txt", ".md")):
        raise HTTPException(
            status_code=400, 
            detail="Only .txt and .md files are supported"
        )
    
    # Save the uploaded file
    file_location = f"{file.filename}"
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Recreate RAG chain with the new document
    try:
        active_document = file_location
        rag_chain = get_rag_chain(document_path=file_location)
        return {"filename": file.filename, "size": file.size, "active": True}
    except Exception as e:
        logger.error(f"Failed to initialize RAG chain: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize RAG chain: {str(e)}"
        )


# List available documents
@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    """List all available documents"""
    documents = []
    
    # Scan directory for .txt and .md files
    for filename in os.listdir("."):
        if filename.endswith((".txt", ".md")):
            size = os.path.getsize(filename)
            is_active = (filename == active_document)
            documents.append(
                DocumentInfo(
                    filename=filename,
                    size=size,
                    active=is_active
                )
            )
    
    return documents


# Endpoint to see the conversation memory
@app.get("/history")
async def get_history():
    """Return the current state of the conversation memory."""
    try:
        # For debugging purposes, let's first check what's available in the chain
        chain_dict = vars(rag_chain)
        memory_dict = {}
        history = []
        summary = ""
        
        # Check if memory exists
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            memory = rag_chain.memory
            memory_dict = vars(memory)
            logger.info(f"Memory attributes: {list(memory_dict.keys())}")
            
            # Check for chat_memory
            if hasattr(memory, 'chat_memory') and memory.chat_memory is not None:
                # Access messages if they exist
                if hasattr(memory.chat_memory, 'messages'):
                    raw_messages = memory.chat_memory.messages
                    logger.info(f"Number of messages: {len(raw_messages)}")
                    for msg in raw_messages:
                        history.append({
                            "role": getattr(msg, "type", str(type(msg))),
                            "content": getattr(msg, "content", str(msg))
                        })
            
            # Check for moving summary
            if hasattr(memory, 'moving_summary_buffer'):
                summary = memory.moving_summary_buffer
                logger.info(f"Summary buffer: {summary}")
        
        # Return the data in a structured way
        return {
            "history": history,
            "summary": summary,
            "memory_attributes": list(memory_dict.keys()) if memory_dict else [],
            "chain_attributes": list(chain_dict.keys())
        }
    except Exception as e:
        # Include the error details for debugging
        logger.error(f"Error in get_history: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving conversation history: {str(e)}"
        )


# Main Q‑and‑A route
@app.post("/ask")
async def ask_question(query: Query):
    try:
        # Log the memory state before processing
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            memory = rag_chain.memory
            logger.info("Before processing - Memory attributes: %s", list(vars(memory).keys()))
            if hasattr(memory, 'moving_summary_buffer'):
                logger.info("Before processing - Summary buffer: %s", memory.moving_summary_buffer)
            if hasattr(memory, 'chat_memory') and hasattr(memory.chat_memory, 'messages'):
                logger.info("Before processing - Message count: %d", len(memory.chat_memory.messages))

        # ConversationalRetrievalChain expects the key **question**
        result = invoke_with_retry(rag_chain, {"question": query.input})

        # Log the memory state after processing
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            memory = rag_chain.memory
            logger.info("After processing - Memory attributes: %s", list(vars(memory).keys()))
            if hasattr(memory, 'moving_summary_buffer'):
                logger.info("After processing - Summary buffer: %s", memory.moving_summary_buffer)
            if hasattr(memory, 'chat_memory') and hasattr(memory.chat_memory, 'messages'):
                logger.info("After processing - Message count: %d", len(memory.chat_memory.messages))

        if result is None:
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable due to rate limiting",
            )

        # Log the full result for debugging
        logger.info(f"Result keys: {result.keys()}")
        
        # result is a dict like {"answer": "...", "chat_history": [...]}
        return {"answer": result["answer"]}

    except HTTPException:
        # Re‑raise explicit FastAPI errors unchanged
        raise
    except Exception as e:
        # Anything else → 500
        logger.error(f"Error in ask_question: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}",
        )


# Activate a document
@app.post("/activate-document/{filename}")
async def activate_document(filename: str):
    """Set a document as the active one for the RAG chain"""
    global rag_chain
    global active_document
    
    # Check if file exists
    if not os.path.exists(filename):
        raise HTTPException(
            status_code=404,
            detail=f"Document '{filename}' not found"
        )
    
    # Recreate RAG chain with the new document
    try:
        active_document = filename
        rag_chain = get_rag_chain(document_path=filename)
        
        # Reset the conversation memory for the new document context
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            # Clear the chat messages
            if hasattr(rag_chain.memory, 'chat_memory'):
                rag_chain.memory.chat_memory.clear()
            
            # Reset the buffer/summary
            if hasattr(rag_chain.memory, 'moving_summary_buffer'):
                rag_chain.memory.moving_summary_buffer = ""
                
            logger.info(f"Activated document: {filename} and reset conversation memory")
            return {"status": "success", "message": f"Activated document: {filename} (memory reset)"}
        
        return {"status": "success", "message": f"Activated document: {filename}"}
    except Exception as e:
        logger.error(f"Failed to activate document: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to activate document: {str(e)}"
        )


# Reset conversation memory
@app.post("/reset-memory")
async def reset_memory():
    """Reset the conversation memory"""
    global rag_chain
    
    try:
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            # Clear the chat messages
            if hasattr(rag_chain.memory, 'chat_memory'):
                rag_chain.memory.chat_memory.clear()
            
            # Reset the buffer/summary
            if hasattr(rag_chain.memory, 'moving_summary_buffer'):
                rag_chain.memory.moving_summary_buffer = ""
                
            logger.info("Conversation memory has been reset")
            return {"status": "success", "message": "Conversation memory has been reset"}
        else:
            return {"status": "warning", "message": "No memory found to reset"}
    except Exception as e:
        logger.error(f"Failed to reset memory: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset memory: {str(e)}"
        )
