from fastapi import FastAPI
from pydantic import BaseModel
from rag_chain import get_rag_chain

app = FastAPI()
rag_chain = get_rag_chain()

class Query(BaseModel):
    input: str

@app.post("/ask")
def ask_question(query: Query):
    result = rag_chain.invoke({"input": query.input})
    return {"answer": result["answer"]}
