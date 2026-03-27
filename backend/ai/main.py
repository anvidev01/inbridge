from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import uvicorn
import os
from rag_chain import RAGChain
from guardrails import sanitize_input

app = FastAPI(title="InBridge AI Service", version="1.0.0")

db_url = os.getenv("DB_URL", "postgresql://inbridge:inbridge_secret@localhost:5432/inbridge_db")
rag_engine = RAGChain(db_url)

class ChatRequest(BaseModel):
    query: str
    citizen_id: str

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    is_safe, reason = sanitize_input(req.query)
    if not is_safe:
        raise HTTPException(status_code=400, detail=f"Input rejected: {reason}")
    
    try:
        response = rag_engine.ask(req.query, req.citizen_id)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-engine"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
