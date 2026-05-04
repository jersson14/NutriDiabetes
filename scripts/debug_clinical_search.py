"""
Diagnóstico: verifica si el namespace 'clinical' devuelve resultados
y con qué scores para las queries del chat.

Uso:
    cd scripts
    python debug_clinical_search.py
"""
import os
import sys
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, "..", "backend", ".env"))

from openai import OpenAI
from pinecone import Pinecone

OPENAI_KEY  = os.getenv("OPENAI_API_KEY")
PINECONE_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "nutri-diabetes-peru")

if not OPENAI_KEY or not PINECONE_KEY:
    print("❌ Falta OPENAI_API_KEY o PINECONE_API_KEY en backend/.env")
    sys.exit(1)

client = OpenAI(api_key=OPENAI_KEY)
pc     = Pinecone(api_key=PINECONE_KEY)
index  = pc.Index(PINECONE_INDEX)

# Queries a probar: español y su equivalente en inglés
QUERIES = [
    ("ES", "¿Cuántas personas tienen diabetes en el mundo según el IDF?"),
    ("EN", "How many people have diabetes worldwide according to IDF?"),
    ("ES", "¿Cuál es el objetivo de HbA1c recomendado por la ADA para DM2?"),
    ("EN", "What is the HbA1c target recommended by ADA for type 2 diabetes?"),
    ("ES", "complicaciones de la diabetes tipo 2"),
    ("EN", "complications of type 2 diabetes"),
]

print("=" * 70)
print("DIAGNÓSTICO: Búsqueda en namespace 'clinical'")
print(f"Índice: {PINECONE_INDEX}")
print("=" * 70)

for lang, query in QUERIES:
    emb_resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=query
    )
    vector = emb_resp.data[0].embedding

    results = index.query(
        vector=vector,
        top_k=3,
        include_metadata=True,
        namespace="clinical"
    )

    print(f"\n[{lang}] {query[:65]}")
    print(f"  {'─'*65}")
    if not results.matches:
        print("  ⚠️  Sin resultados")
    for m in results.matches:
        meta  = m.metadata or {}
        title = meta.get("title", "?")[:35]
        page  = meta.get("page_num", "?")
        text  = meta.get("text", "")[:80].replace("\n", " ")
        print(f"  score={m.score:.4f}  [{title}] p.{page}")
        print(f"           extracto: {text}...")

print("\n" + "=" * 70)
print("INTERPRETACIÓN DE SCORES:")
print("  ≥ 0.50  → Alta relevancia (query y contenido bien alineados)")
print("  ≥ 0.30  → Relevancia media (threshold actual del RAG service)")
print("  < 0.30  → Baja relevancia (filtrado fuera, LLM sin contexto clínico)")
print()
print("Si los scores EN son más altos que ES → problema cross-lingüístico.")
print("Solución: cambiar RELEVANCE_THRESHOLD a 0.20 en rag_service.py")
print("=" * 70)
