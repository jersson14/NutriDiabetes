"""
============================================================
INDEXAR PDFs CLÍNICOS — NutriDiabetes Perú
============================================================
Extrae texto por página de los PDFs clínicos (IDF Atlas,
ADA Standards) y los indexa en Pinecone con metadata de
página para trazabilidad completa en tesis.

Uso:
    pip install pymupdf openai pinecone-client python-dotenv
    python indexar_pdfs_clinicos.py
============================================================
"""

import os
import json
import time
import hashlib
import re
from datetime import datetime
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ENV = os.path.join(SCRIPT_DIR, "..", "backend", ".env")
if os.path.exists(BACKEND_ENV):
    load_dotenv(BACKEND_ENV)
    print(f"✅ Variables cargadas desde: {BACKEND_ENV}")
else:
    load_dotenv()
    print("⚠️ Usando .env local")

try:
    import fitz  # PyMuPDF
except ImportError:
    print("❌ Instala PyMuPDF: pip install pymupdf")
    exit(1)

from openai import OpenAI
from pinecone import Pinecone

# ============================================================
# CATÁLOGO DE PDFs CLÍNICOS
# ============================================================

PDF_CATALOG = [
    {
        "filename": "IDF_Diabetes_Atlas_11th_Edition_2025_WEB.pdf",
        "doc_id": "idf-atlas-2025",
        "institution": "International Diabetes Federation (IDF)",
        "title": "IDF Diabetes Atlas, 11th Edition",
        "year": 2025,
        "source_type": "atlas_clinico",
        "skip_pages": 3,
    },
    {
        "filename": "standards-of-care-2026.pdf",
        "doc_id": "ada-standards-2026",
        "institution": "American Diabetes Association (ADA)",
        "title": "Standards of Medical Care in Diabetes 2026",
        "year": 2026,
        "source_type": "guia_clinica",
        "skip_pages": 2,
    },
]

# Mismo modelo que usa rag_service.py para consultas
EMBEDDING_MODEL = "text-embedding-3-small"
# Namespace separado del TPCA para no mezclar dominios
CLINICAL_NAMESPACE = "clinical"

CHUNK_SIZE_CHARS = 1500   # ~400 tokens aprox
CHUNK_OVERLAP_CHARS = 250
BATCH_SIZE = 50

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "nutri-diabetes-peru")


def compute_hash(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            h.update(block)
    return h.hexdigest()[:16]


def extract_pages(pdf_path: str, skip_pages: int = 0) -> list:
    """Extrae texto por página del PDF, retornando página real del documento."""
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        if i < skip_pages:
            continue
        text = page.get_text("text")
        text_clean = text.strip()
        if len(text_clean) > 50:
            pages.append({
                "page_num": i + 1,
                "text": text_clean
            })
    doc.close()
    return pages


def chunk_page(text: str, page_num: int) -> list:
    """Divide el texto de una página en chunks con overlap."""
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)

    chunks = []
    start = 0
    chunk_idx = 0

    while start < len(text):
        end = start + CHUNK_SIZE_CHARS

        if end < len(text):
            # Cortar en párrafo o punto para no partir oraciones
            cut = text.rfind('\n', start + CHUNK_SIZE_CHARS // 2, end)
            if cut == -1:
                cut = text.rfind('. ', start + CHUNK_SIZE_CHARS // 2, end)
            if cut != -1:
                end = cut + 1

        fragment = text[start:end].strip()
        if len(fragment) > 80:
            chunks.append({
                "chunk_idx": chunk_idx,
                "page_num": page_num,
                "text": fragment,
            })
            chunk_idx += 1

        start = end - CHUNK_OVERLAP_CHARS
        if start >= len(text):
            break

    return chunks


def generate_embeddings(texts: list, client: OpenAI) -> list:
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


def main():
    print("=" * 60)
    print("📚 INDEXAR PDFs CLÍNICOS — NutriDiabetes Perú")
    print("=" * 60)

    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY no configurada")
        return
    if not PINECONE_API_KEY:
        print("❌ PINECONE_API_KEY no configurada")
        return

    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    pc = Pinecone(api_key=PINECONE_API_KEY)

    try:
        index = pc.Index(PINECONE_INDEX)
        stats = index.describe_index_stats()
        ns_info = stats.namespaces or {}
        clinical_count = ns_info.get(CLINICAL_NAMESPACE, {})
        print(f"✅ Índice '{PINECONE_INDEX}' conectado")
        print(f"   Namespace '{CLINICAL_NAMESPACE}': {clinical_count}")
    except Exception as e:
        print(f"❌ Error conectando Pinecone: {e}")
        return

    corpus_info = []

    for pdf_meta in PDF_CATALOG:
        pdf_path = os.path.join(SCRIPT_DIR, pdf_meta["filename"])

        if not os.path.exists(pdf_path):
            print(f"\n⚠️ PDF no encontrado: {pdf_path}")
            print(f"   Verifica que el archivo esté en scripts/")
            continue

        pdf_hash = compute_hash(pdf_path)
        fecha_indexado = datetime.now().isoformat()

        print(f"\n{'─'*60}")
        print(f"📄 {pdf_meta['title']}")
        print(f"   Institución : {pdf_meta['institution']}")
        print(f"   Año         : {pdf_meta['year']}")
        print(f"   Hash SHA256 : {pdf_hash}")

        print(f"   Extrayendo páginas...", end="", flush=True)
        pages = extract_pages(pdf_path, skip_pages=pdf_meta["skip_pages"])
        print(f" {len(pages)} páginas con texto")

        all_chunks = []
        for page in pages:
            page_chunks = chunk_page(page["text"], page["page_num"])
            all_chunks.extend(page_chunks)
        print(f"   Chunks generados: {len(all_chunks)}")

        total_subidos = 0
        for i in range(0, len(all_chunks), BATCH_SIZE):
            batch = all_chunks[i:i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (len(all_chunks) + BATCH_SIZE - 1) // BATCH_SIZE

            print(f"   📦 Lote {batch_num}/{total_batches}...", end="", flush=True)

            try:
                texts = [c["text"] for c in batch]
                embeddings = generate_embeddings(texts, openai_client)

                vectors = []
                for j, chunk in enumerate(batch):
                    chunk_id = f"{pdf_meta['doc_id']}__p{chunk['page_num']}_c{chunk['chunk_idx']}"
                    vectors.append({
                        "id": chunk_id,
                        "values": embeddings[j],
                        "metadata": {
                            "doc_id":        pdf_meta["doc_id"],
                            "filename":      pdf_meta["filename"],
                            "title":         pdf_meta["title"],
                            "institution":   pdf_meta["institution"],
                            "year":          pdf_meta["year"],
                            "source_type":   pdf_meta["source_type"],
                            "page_num":      chunk["page_num"],
                            "chunk_idx":     chunk["chunk_idx"],
                            "pdf_hash":      pdf_hash,
                            "fecha_indexado": fecha_indexado,
                            # Primeros 1000 chars del texto para mostrar extractos
                            "text":          chunk["text"][:1000],
                        }
                    })

                index.upsert(vectors=vectors, namespace=CLINICAL_NAMESPACE)
                total_subidos += len(batch)
                print(f" ✅ ({total_subidos}/{len(all_chunks)})")
                time.sleep(0.3)

            except Exception as e:
                print(f" ❌ Error: {e}")
                time.sleep(2)

        corpus_info.append({
            "doc_id":         pdf_meta["doc_id"],
            "filename":       pdf_meta["filename"],
            "title":          pdf_meta["title"],
            "institution":    pdf_meta["institution"],
            "year":           pdf_meta["year"],
            "source_type":    pdf_meta["source_type"],
            "pdf_hash":       pdf_hash,
            "fecha_indexado": fecha_indexado,
            "total_paginas":  len(pages),
            "total_chunks":   len(all_chunks),
            "total_indexados": total_subidos,
            "namespace":      CLINICAL_NAMESPACE,
            "embedding_model": EMBEDDING_MODEL,
        })

    # Guardar metadata para auditoría de tesis
    data_dir = os.path.join(SCRIPT_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    corpus_json = os.path.join(data_dir, "corpus_clinico_info.json")
    with open(corpus_json, "w", encoding="utf-8") as f:
        json.dump(corpus_info, f, ensure_ascii=False, indent=2)

    # Verificar resultado final
    time.sleep(2)
    stats_final = index.describe_index_stats()
    ns_final = stats_final.namespaces or {}
    clinical_final = ns_final.get(CLINICAL_NAMESPACE, {})

    print(f"\n{'='*60}")
    print(f"✅ INDEXACIÓN COMPLETADA")
    print(f"{'='*60}")
    print(f"   Namespace '{CLINICAL_NAMESPACE}': {clinical_final}")
    print(f"   Metadata guardada en: scripts/data/corpus_clinico_info.json")
    print(f"\n🎉 El RAG ahora cita IDF Atlas y ADA Standards con páginas.")
    print(f"   Ejecuta el chat y verás 'Fuentes' en cada respuesta clínica.")


if __name__ == "__main__":
    main()
