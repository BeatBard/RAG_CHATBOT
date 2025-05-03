from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_chain import get_rag_chain, invoke_with_retry

app = FastAPI()

# Configure CORS to allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_chain = get_rag_chain()

class Query(BaseModel):
    input: str

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Server is running"}

@app.post("/ask")
async def ask_question(query: Query):
    try:
        result = invoke_with_retry(rag_chain, {"input": query.input})
        if result is None:
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable due to rate limiting"
            )
        return {"answer": result["answer"]}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}"
        )
