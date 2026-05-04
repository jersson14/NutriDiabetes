"""
============================================================
SUBIR CHUNKS A PINECONE — NutriDiabetes Perú
============================================================
Lee los chunks generados por extraer_tpca_2025.py y los sube
al índice 'nutri-diabetes-peru' en Pinecone.

Uso:
    pip install openai pinecone-client python-dotenv
    python subir_a_pinecone.py
"""

import json
import os
import time
from dotenv import load_dotenv

# Cargar .env del backend
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ENV = os.path.join(SCRIPT_DIR, "..", "backend", ".env")
if os.path.exists(BACKEND_ENV):
    load_dotenv(BACKEND_ENV)
    print(f"✅ Variables cargadas desde: {BACKEND_ENV}")
else:
    load_dotenv()
    print("⚠️ Usando .env local o variables de entorno del sistema")

from openai import OpenAI
from pinecone import Pinecone

# ============================================================
# CONFIGURACIÓN
# ============================================================

CHUNKS_PATH = os.path.join(SCRIPT_DIR, "data", "pinecone_chunks.json")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "nutri-diabetes-peru")

EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536
BATCH_SIZE = 50  # Pinecone acepta hasta 100 vectores por upsert


def generar_embeddings(textos, client):
    """Genera embeddings usando OpenAI."""
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=textos
    )
    return [item.embedding for item in response.data]


def main():
    print("=" * 60)
    print("📌 SUBIR DATOS A PINECONE — NutriDiabetes Perú")
    print("=" * 60)
    print()

    # Validar configuración
    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY no configurada")
        print("   Verifica tu archivo backend/.env")
        return
    
    if not PINECONE_API_KEY:
        print("❌ PINECONE_API_KEY no configurada")
        print("   Verifica tu archivo backend/.env")
        return

    # Leer chunks
    if not os.path.exists(CHUNKS_PATH):
        print(f"❌ No se encontró: {CHUNKS_PATH}")
        print("   Ejecuta primero: python extraer_tpca_2025.py")
        return
    
    with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    
    print(f"📋 Chunks cargados: {len(chunks)}")
    print(f"🔑 OpenAI API Key: ...{OPENAI_API_KEY[-8:]}")
    print(f"🔑 Pinecone API Key: ...{PINECONE_API_KEY[-8:]}")
    print(f"📌 Índice Pinecone: {PINECONE_INDEX}")
    print(f"🧠 Modelo embeddings: {EMBEDDING_MODEL}")
    print()

    # Inicializar clientes
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    pc = Pinecone(api_key=PINECONE_API_KEY)
    
    # Verificar que el índice existe
    try:
        index = pc.Index(PINECONE_INDEX)
        stats = index.describe_index_stats()
        print(f"✅ Índice '{PINECONE_INDEX}' conectado")
        print(f"   Vectores actuales: {stats.total_vector_count}")
        print(f"   Dimensión: {stats.dimension}")
        print()
    except Exception as e:
        print(f"❌ Error conectando al índice: {e}")
        print("   Verifica que el índice 'nutri-diabetes-peru' existe en Pinecone")
        return

    # Procesar por lotes
    total_subidos = 0
    total_errores = 0
    inicio = time.time()

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"  📦 Procesando lote {batch_num}/{total_batches} "
              f"({len(batch)} chunks)...", end="")
        
        try:
            # 1. Generar embeddings
            textos = [c["text"] for c in batch]
            embeddings = generar_embeddings(textos, openai_client)
            
            # 2. Preparar vectores para Pinecone
            vectors = []
            for j, chunk in enumerate(batch):
                # Limpiar metadata: Pinecone NO acepta valores null
                clean_meta = {k: v for k, v in chunk["metadata"].items() if v is not None}
                clean_meta["text"] = chunk["text"]  # Texto original para retrieval
                
                vectors.append({
                    "id": chunk["id"],
                    "values": embeddings[j],
                    "metadata": clean_meta
                })
            
            # 3. Upsert a Pinecone
            index.upsert(vectors=vectors)
            total_subidos += len(batch)
            print(f" ✅ ({total_subidos}/{len(chunks)})")
            
            # Pequeña pausa para no saturar la API
            time.sleep(0.5)
            
        except Exception as e:
            total_errores += len(batch)
            print(f" ❌ Error: {e}")
            time.sleep(2)  # Esperar más en caso de error
    
    # Verificar resultado final
    time.sleep(2)
    stats_final = index.describe_index_stats()
    duracion = time.time() - inicio
    
    print(f"\n{'='*60}")
    print(f"✅ SUBIDA COMPLETADA")
    print(f"{'='*60}")
    print(f"  ✅ Subidos exitosamente: {total_subidos}")
    print(f"  ❌ Errores: {total_errores}")
    print(f"  ⏱️  Tiempo total: {duracion:.1f} segundos")
    print(f"  📌 Vectores en Pinecone: {stats_final.total_vector_count}")
    print()
    print("🎉 ¡Tu índice Pinecone está listo!")
    print("   El Chat RAG de NutriDiabetes ahora puede buscar")
    print("   semánticamente en la Tabla Peruana de Alimentos.")


if __name__ == "__main__":
    main()
