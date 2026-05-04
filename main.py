"""
============================================
NutriDiabetes Perú - Microservicio RAG
FastAPI + OpenAI + Pinecone
============================================
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import os
import time

load_dotenv()

from app.rag_service import RAGService
from app.embeddings_service import EmbeddingsService

app = FastAPI(
    title="NutriDiabetes RAG API",
    description="Microservicio de IA para recomendaciones nutricionales DM2",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar servicios
rag_service = RAGService()
embeddings_service = EmbeddingsService()


# ── Modelos Pydantic ──

class PerfilSalud(BaseModel):
    clasificacion_dm2: Optional[str] = "DM2_SIN_COMPLICACIONES"
    hemoglobina_glicosilada: Optional[float] = None
    usa_insulina: Optional[bool] = False
    usa_metformina: Optional[bool] = False
    alergias: Optional[List[str]] = []
    intolerancias: Optional[List[str]] = []
    restricciones: Optional[List[str]] = []
    carbohidratos_max: Optional[float] = 45.0
    calorias_max: Optional[int] = 2000

class MensajeHistorial(BaseModel):
    rol: str
    contenido: str

class RecommendRequest(BaseModel):
    mensaje: str
    perfil_salud: Optional[PerfilSalud] = None
    historial: Optional[List[MensajeHistorial]] = []

class EmbeddingRequest(BaseModel):
    alimentos: List[Dict[str, Any]]

class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5


# ── Endpoints ──

@app.get("/")
async def root():
    return {
        "service": "NutriDiabetes RAG API",
        "status": "active",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "pinecone": rag_service.check_connection(),
        "openai": "configured" if os.getenv("OPENAI_API_KEY") else "missing"
    }


@app.post("/api/recommend")
async def recommend(request: RecommendRequest):
    """
    Endpoint principal: Recibe mensaje del usuario y genera recomendación nutricional.
    Pipeline: Query → Embedding → Pinecone → Context → LLM → Respuesta
    """
    try:
        start_time = time.time()

        result = await rag_service.generate_recommendation(
            mensaje=request.mensaje,
            perfil_salud=request.perfil_salud,
            historial=request.historial
        )

        elapsed = int((time.time() - start_time) * 1000)
        result["tiempo_ms"] = elapsed

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/embeddings/generate")
async def generate_embeddings(request: EmbeddingRequest):
    """Genera embeddings para alimentos y los sube a Pinecone."""
    try:
        result = await embeddings_service.generate_and_upload(request.alimentos)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search")
async def search_alimentos(request: QueryRequest):
    """Búsqueda semántica en Pinecone."""
    try:
        results = await rag_service.search_context(request.query, request.top_k)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AI_SERVICE_PORT", 8000))
    host = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port)

