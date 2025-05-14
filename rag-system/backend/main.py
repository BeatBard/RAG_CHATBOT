# main.py ────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from rag_chain import get_rag_chain, invoke_with_retry
import logging
import os
import shutil
from typing import List
from datetime import datetime
from pathlib import Path

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Create necessary directories
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="RAG Chatbot API",
    description="A Retrieval-Augmented Generation chatbot API with memory",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
active_document = "essay.txt"  # Default document
document_metadata = {}  # Store metadata for each document

# Build the RAG chain once at startup
rag_chain = get_rag_chain(document_path=active_document)

# Request/Response Models
class Query(BaseModel):
    input: str = Field(..., min_length=1, max_length=1000)

class DocumentInfo(BaseModel):
    filename: str
    size: int
    active: bool
    last_modified: datetime
    upload_date: datetime

class ErrorResponse(BaseModel):
    detail: str
    code: str
    timestamp: datetime = Field(default_factory=datetime.now)

# Error handling middleware
@app.middleware("http")
async def error_handling_middleware(request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        logger.error(f"Unhandled error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                detail="Internal server error",
                code="INTERNAL_ERROR"
            ).dict()
        )

# Health check with detailed status
@app.get("/health")
async def health_check():
    try:
        # Check if RAG chain is properly initialized
        chain_status = "ok" if rag_chain is not None else "error"
        
        # Check if active document exists
        doc_status = "ok" if os.path.exists(active_document) else "error"
        
        # Check available memory
        memory_status = "ok" if hasattr(rag_chain, 'memory') else "error"
        
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "components": {
                "rag_chain": chain_status,
                "active_document": doc_status,
                "memory": memory_status
            },
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

# Upload document with metadata
@app.post("/upload-document", response_model=DocumentInfo)
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """Upload a document to be used for RAG"""
    global rag_chain, active_document, document_metadata
    
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided"
        )
    
    # Validate file type
    if not file.filename.endswith((".txt", ".md")):
        raise HTTPException(
            status_code=400,
            detail="Only .txt and .md files are supported"
        )
    
    # Save the uploaded file with metadata
    file_location = UPLOAD_DIR / file.filename
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Store metadata
        document_metadata[file.filename] = {
            "upload_date": datetime.now(),
            "last_modified": datetime.now(),
            "size": file.size
        }
        
        # Update RAG chain in background
        if background_tasks:
            background_tasks.add_task(update_rag_chain, file_location)
        else:
            await update_rag_chain(file_location)
        
        return DocumentInfo(
            filename=file.filename,
            size=file.size,
            active=True,
            last_modified=document_metadata[file.filename]["last_modified"],
            upload_date=document_metadata[file.filename]["upload_date"]
        )
    except Exception as e:
        logger.error(f"Failed to save file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )

async def update_rag_chain(file_location: Path):
    """Update RAG chain with new document"""
    global rag_chain, active_document
    try:
        active_document = str(file_location)
        rag_chain = get_rag_chain(document_path=active_document)
        logger.info(f"Successfully updated RAG chain with {file_location}")
    except Exception as e:
        logger.error(f"Failed to update RAG chain: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize RAG chain: {str(e)}"
        )

# List available documents with metadata
@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    """List all available documents with metadata"""
    documents = []
    
    for filename in os.listdir(UPLOAD_DIR):
        if filename.endswith((".txt", ".md")):
            file_path = UPLOAD_DIR / filename
            size = os.path.getsize(file_path)
            is_active = (filename == active_document)
            
            # Get or create metadata
            if filename not in document_metadata:
                document_metadata[filename] = {
                    "upload_date": datetime.fromtimestamp(os.path.getctime(file_path)),
                    "last_modified": datetime.fromtimestamp(os.path.getmtime(file_path)),
                    "size": size
                }
            
            documents.append(
                DocumentInfo(
                    filename=filename,
                    size=size,
                    active=is_active,
                    last_modified=document_metadata[filename]["last_modified"],
                    upload_date=document_metadata[filename]["upload_date"]
                )
            )
    
    return sorted(documents, key=lambda x: x.last_modified, reverse=True)

# Get conversation history with improved error handling
@app.get("/history")
async def get_history():
    """Return the current state of the conversation memory"""
    try:
        chain_dict = vars(rag_chain)
        memory_dict = {}
        history = []
        summary = ""
        
        # Enhanced debug information
        chain_attributes = []
        memory_attributes = []
        
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            memory = rag_chain.memory
            memory_dict = vars(memory)
            memory_attributes = list(memory_dict.keys())
            
            logger.info(f"Memory attributes: {memory_attributes}")
            
            # Get chat history
            if hasattr(memory, 'chat_memory') and memory.chat_memory is not None:
                if hasattr(memory.chat_memory, 'messages'):
                    raw_messages = memory.chat_memory.messages
                    for msg in raw_messages:
                        history.append({
                            "role": getattr(msg, "type", str(type(msg))),
                            "content": getattr(msg, "content", str(msg)),
                            "timestamp": datetime.now().isoformat()
                        })
            
            # Get summary
            if hasattr(memory, 'buffer'):
                summary = memory.buffer
            elif hasattr(memory, 'moving_summary_buffer'):  # Fallback for backward compatibility
                summary = memory.moving_summary_buffer
        
        # Get detailed chain attributes
        if chain_dict:
            chain_attributes = list(chain_dict.keys())
            logger.info(f"Chain attributes: {chain_attributes}")
        
        # Create a more detailed response
        return {
            "history": history,
            "summary": summary,
            "memory_attributes": memory_attributes,
            "chain_attributes": chain_attributes,
            "active_document": active_document,
            "timestamp": datetime.now().isoformat(),
            "debug": {
                "chain_type": type(rag_chain).__name__,
                "memory_type": type(rag_chain.memory).__name__ if hasattr(rag_chain, 'memory') else None,
                "has_retriever": hasattr(rag_chain, 'retriever'),
                "has_memory": hasattr(rag_chain, 'memory'),
                "history_count": len(history)
            }
        }
    except Exception as e:
        logger.error(f"Error in get_history: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving conversation history: {str(e)}"
        )

# Main Q&A route with improved error handling
@app.post("/ask")
async def ask_question(query: Query):
    """Process a question using the RAG chain"""
    try:
        # Log memory state before processing
        log_memory_state("Before processing")
        
        # Process the question
        logger.info(f"Invoking RAG chain with question: {query.input}")
        
        # Force using the exact question without rephrasing
        question = query.input
        result = invoke_with_retry(rag_chain, {"question": question})
        
        # More detailed logging of the result
        logger.info(f"RAG chain result keys: {result.keys() if result else 'None'}")
        
        # Log memory state after processing 
        logger.info("Checking if memory summary was updated")
        log_memory_state("After processing")
        
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            memory = rag_chain.memory
            # Force memory to generate a new summary if empty
            if hasattr(memory, 'buffer') and not memory.buffer and hasattr(memory, 'predict_new_summary'):
                logger.info("Attempting to force summary generation")
                try:
                    if hasattr(memory, 'chat_memory') and memory.chat_memory is not None and hasattr(memory.chat_memory, 'messages'):
                        if len(memory.chat_memory.messages) >= 2:  # Need at least a human and AI message
                            logger.info(f"Found {len(memory.chat_memory.messages)} messages, generating summary")
                            # Try to manually generate summary
                            memory.buffer = memory.predict_new_summary(
                                memory.buffer or "", memory.chat_memory.messages[-2:]
                            )
                            logger.info(f"Forced summary generation: {memory.buffer}")
                except Exception as e:
                    logger.error(f"Error forcing summary generation: {str(e)}")
            # Backward compatibility
            elif hasattr(memory, 'moving_summary_buffer') and not memory.moving_summary_buffer and hasattr(memory, 'predict_new_summary'):
                # Similar logic for legacy attribute - kept for backward compatibility
                logger.info("Attempting to force legacy summary generation")
                try:
                    if hasattr(memory, 'chat_memory') and memory.chat_memory is not None and hasattr(memory.chat_memory, 'messages'):
                        if len(memory.chat_memory.messages) >= 2:
                            memory.moving_summary_buffer = memory.predict_new_summary(
                                memory.moving_summary_buffer or "", memory.chat_memory.messages[-2:]
                            )
                            logger.info(f"Forced legacy summary generation: {memory.moving_summary_buffer}")
                except Exception as e:
                    logger.error(f"Error forcing legacy summary generation: {str(e)}")
        
        if result is None:
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable due to rate limiting"
            )
        
        return {
            "answer": result["answer"],
            "timestamp": datetime.now().isoformat(),
            "document": active_document
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in ask_question: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}"
        )

def log_memory_state(stage: str):
    """Helper function to log memory state"""
    if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
        memory = rag_chain.memory
        logger.info(f"{stage} - Memory attributes: {list(vars(memory).keys())}")
        
        # Check for summary
        if hasattr(memory, 'buffer'):
            summary = memory.buffer
            logger.info(f"{stage} - Summary buffer exists: {bool(summary)}")
            logger.info(f"{stage} - Summary type: {type(summary)}")
            logger.info(f"{stage} - Summary length: {len(summary) if summary else 0}")
            logger.info(f"{stage} - Summary content: '{summary}'")
        elif hasattr(memory, 'moving_summary_buffer'):  # Fallback for backward compatibility
            summary = memory.moving_summary_buffer
            logger.info(f"{stage} - Legacy summary buffer exists: {bool(summary)}")
            logger.info(f"{stage} - Legacy summary type: {type(summary)}")
            logger.info(f"{stage} - Legacy summary length: {len(summary) if summary else 0}")
            logger.info(f"{stage} - Legacy summary content: '{summary}'")
        else:
            logger.info(f"{stage} - No summary buffer attribute found")
            
        # Check for chat messages
        if hasattr(memory, 'chat_memory') and hasattr(memory.chat_memory, 'messages'):
            messages = memory.chat_memory.messages
            logger.info(f"{stage} - Message count: {len(messages)}")
            if messages:
                logger.info(f"{stage} - Last message: {messages[-1]}")
        else:
            logger.info(f"{stage} - No chat messages found")

# Activate document with improved error handling
@app.post("/activate-document/{filename}")
async def activate_document(filename: str):
    """Set a document as the active one for the RAG chain"""
    global rag_chain, active_document
    
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Document '{filename}' not found"
        )
    
    try:
        active_document = str(file_path)
        rag_chain = get_rag_chain(document_path=active_document)
        
        # Reset conversation memory
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            if hasattr(rag_chain.memory, 'chat_memory'):
                rag_chain.memory.chat_memory.clear()
            if hasattr(rag_chain.memory, 'buffer'):
                rag_chain.memory.buffer = ""
            elif hasattr(rag_chain.memory, 'moving_summary_buffer'):  # Backward compatibility
                rag_chain.memory.moving_summary_buffer = ""
        
        # Update metadata
        if filename in document_metadata:
            document_metadata[filename]["last_modified"] = datetime.now()
        
        logger.info(f"Activated document: {filename} and reset conversation memory")
        return {
            "status": "success",
            "message": f"Activated document: {filename} (memory reset)",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to activate document: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to activate document: {str(e)}"
        )

# Reset memory endpoint
@app.post("/reset-memory")
async def reset_memory():
    """Reset the conversation memory"""
    try:
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            if hasattr(rag_chain.memory, 'chat_memory'):
                rag_chain.memory.chat_memory.clear()
            if hasattr(rag_chain.memory, 'buffer'):
                rag_chain.memory.buffer = ""
            elif hasattr(rag_chain.memory, 'moving_summary_buffer'):  # Backward compatibility
                rag_chain.memory.moving_summary_buffer = ""
            
            logger.info("Conversation memory reset successfully")
            return {
                "status": "success",
                "message": "Conversation memory reset",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="No memory to reset"
            )
    except Exception as e:
        logger.error(f"Failed to reset memory: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset memory: {str(e)}"
        )

# Force summary generation endpoint
@app.post("/generate-summary")
async def generate_summary():
    """Force generation of conversation summary"""
    try:
        if hasattr(rag_chain, 'memory') and rag_chain.memory is not None:
            memory = rag_chain.memory
            
            if hasattr(memory, 'chat_memory') and memory.chat_memory is not None and hasattr(memory.chat_memory, 'messages'):
                messages = memory.chat_memory.messages
                
                if len(messages) < 2:
                    return {
                        "status": "warning",
                        "message": "Not enough messages to generate a summary (need at least one human and one AI message)",
                        "timestamp": datetime.now().isoformat()
                    }
                
                # Try to manually generate summary
                if hasattr(memory, 'predict_new_summary'):
                    old_summary = ""
                    
                    # Get existing summary
                    if hasattr(memory, 'buffer'):
                        old_summary = memory.buffer or ""
                    elif hasattr(memory, 'moving_summary_buffer'):
                        old_summary = memory.moving_summary_buffer or ""
                    
                    # Generate new summary
                    new_summary = memory.predict_new_summary(
                        old_summary, 
                        messages
                    )
                    
                    # Store the new summary
                    if hasattr(memory, 'buffer'):
                        memory.buffer = new_summary
                    elif hasattr(memory, 'moving_summary_buffer'):
                        memory.moving_summary_buffer = new_summary
                    
                    logger.info(f"Manually generated summary: {new_summary}")
                    
                    return {
                        "status": "success",
                        "message": "Summary generated successfully",
                        "summary": new_summary,
                        "old_summary": old_summary,
                        "timestamp": datetime.now().isoformat()
                    }
                else:
                    return {
                        "status": "error",
                        "message": "Memory doesn't have predict_new_summary method",
                        "timestamp": datetime.now().isoformat()
                    }
            else:
                return {
                    "status": "error",
                    "message": "No chat messages found in memory",
                    "timestamp": datetime.now().isoformat()
                }
        else:
            return {
                "status": "error",
                "message": "No memory available",
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error generating summary: {str(e)}"
        )
