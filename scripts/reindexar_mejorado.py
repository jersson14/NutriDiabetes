"""
============================================================
RE-INDEXAR PINECONE — Embeddings Enriquecidos v2
NutriDiabetes Perú | Tesis Maestría
============================================================
Flujo (igual que subir_a_pinecone.py pero con texto enriquecido):
  1. Lee  scripts/data/pinecone_chunks.json
  2. Enriquece cada chunk con:
       - Sinónimos de alimentos peruanos (olluco=papalisa, tarwi=chocho...)
       - Carga Glucémica (CG = IG × carbs / 100)
       - Clasificación IG: MUY BAJO / BAJO / MEDIO / ALTO
  3. Genera embeddings con text-embedding-3-small (más nuevo que ada-002)
  4. Sube (upsert) a Pinecone sobreescribiendo vectores anteriores

Uso:
  cd scripts
  pip install openai pinecone python-dotenv
  python reindexar_mejorado.py
============================================================
"""

import json
import os
import time
from typing import List, Dict

from dotenv import load_dotenv

# ── Cargar .env: backend primero, ai-service sobreescribe modelo embedding ───
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
BACKEND_ENV   = os.path.join(SCRIPT_DIR, "..", "backend", ".env")
AISERVICE_ENV = os.path.join(SCRIPT_DIR, "..", "ai-service", ".env")

if os.path.exists(BACKEND_ENV):
    load_dotenv(BACKEND_ENV, override=False)
    print(f"✅ Variables cargadas: backend/.env")
if os.path.exists(AISERVICE_ENV):
    load_dotenv(AISERVICE_ENV, override=True)
    print(f"✅ Variables cargadas: ai-service/.env")

from openai import OpenAI
from pinecone import Pinecone

# ── Configuración ────────────────────────────────────────────────────────────
CHUNKS_PATH     = os.path.join(SCRIPT_DIR, "data", "pinecone_chunks.json")
EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
PINECONE_INDEX  = os.getenv("PINECONE_INDEX", "nutri-diabetes-peru")
BATCH_SIZE      = 50

# ── Sinónimos de alimentos peruanos ─────────────────────────────────────────
SINONIMOS: Dict[str, List[str]] = {
    "kiwicha":    ["amaranto", "amaranth", "achita"],
    "olluco":     ["papalisa", "ulluco", "melloco"],
    "tarwi":      ["chocho", "chochos", "lupino"],
    "canihua":    ["cañihua", "kañiwa"],
    "quinua":     ["quinoa"],
    "aguaymanto": ["physalis", "uchuva", "capulí"],
    "camote":     ["batata", "boniato"],
    "yuca":       ["mandioca", "cassava"],
    "palta":      ["aguacate", "avocado"],
    "camu camu":  ["camu-camu"],
    "mashua":     ["mashwa", "cubio", "isaño"],
    "oca":        ["okka"],
    "lucuma":     ["lúcuma"],
    "maca":       ["lepidium meyenii"],
    "maracuya":   ["maracuyá", "passion fruit"],
    "granadilla": ["passionfruit"],
    "choclo":     ["maíz fresco", "elote"],
    "frijol":     ["frejol", "fréjol", "poroto"],
    "jurel":      ["jack mackerel", "pescado azul"],
    "anchoveta":  ["anchovy", "engraulis ringens"],
}

def _get_sinonimos_texto(nombre: str) -> str:
    """Retorna texto de sinónimos para agregar al chunk."""
    n = nombre.lower()
    for clave, syns in SINONIMOS.items():
        if clave in n:
            return f"También conocido como: {', '.join(syns)}."
        for s in syns:
            if s in n:
                otros = [clave] + [x for x in syns if x != s]
                return f"También conocido como: {', '.join(otros)}."
    return ""

def _clasificar_ig(ig: float) -> str:
    if ig <= 40:  return "MUY BAJO"
    if ig <= 55:  return "BAJO"
    if ig <= 69:  return "MEDIO"
    return "ALTO"

def enriquecer_texto(chunk: Dict) -> str:
    """
    Toma el texto original del chunk y agrega sinónimos + Carga Glucémica.
    El texto original ya tiene toda la info nutricional de la TPCA.
    """
    texto_original = chunk.get("text", "")
    meta = chunk.get("metadata", {})

    extras = []

    # Sinónimos
    nombre = meta.get("nombre", "")
    sin = _get_sinonimos_texto(nombre)
    if sin:
        extras.append(sin)

    # Carga Glucémica
    ig    = meta.get("indice_glucemico") or 0
    carbs = meta.get("carbohidratos_g") or 0
    if ig and carbs:
        cg = round(float(ig) * float(carbs) / 100, 1)
        clasif_ig = _clasificar_ig(float(ig))
        clasif_cg = "BAJA" if cg < 10 else ("MEDIA" if cg < 20 else "ALTA")
        extras.append(
            f"Índice Glucémico (IG): {ig} — {clasif_ig}. "
            f"Carga Glucémica (CG): {cg} — {clasif_cg} "
            f"(CG = IG × carbohidratos / 100)."
        )

    if extras:
        return texto_original.rstrip(".") + " " + " ".join(extras)
    return texto_original

def enriquecer_metadata(chunk: Dict) -> Dict:
    """Agrega campos sinonimos y carga_glucemica a la metadata."""
    meta = dict(chunk.get("metadata", {}))
    nombre = meta.get("nombre", "")
    sin = _get_sinonimos_texto(nombre)
    meta["sinonimos"] = sin.replace("También conocido como: ", "").rstrip(".") if sin else ""

    ig    = meta.get("indice_glucemico") or 0
    carbs = meta.get("carbohidratos_g") or 0
    meta["carga_glucemica"] = round(float(ig) * float(carbs) / 100, 1) if ig and carbs else 0.0
    return meta

def generar_embeddings(textos: List[str], client: OpenAI) -> List[List[float]]:
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=textos)
    return [item.embedding for item in response.data]


def main():
    SEP = "=" * 65
    print(SEP)
    print("  RE-INDEXAR PINECONE — Embeddings Enriquecidos v2")
    print("  NutriDiabetes Perú | Tesis Maestría")
    print(SEP)
    print(f"\n  Modelo de embedding: {EMBEDDING_MODEL}")
    print(f"  Índice Pinecone:     {PINECONE_INDEX}")

    # ── Validar credenciales ─────────────────────────────────────────────────
    for var in ["OPENAI_API_KEY", "PINECONE_API_KEY"]:
        if not os.getenv(var):
            print(f"\n❌ {var} no configurada.")
            return

    # ── Leer chunks ──────────────────────────────────────────────────────────
    if not os.path.exists(CHUNKS_PATH):
        print(f"\n❌ No se encontró: {CHUNKS_PATH}")
        print("   Ejecuta primero: python extraer_tpca_2025.py")
        return

    with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    print(f"\n1. Chunks cargados desde JSON: {len(chunks)}")

    # ── Vista previa de enriquecimiento ──────────────────────────────────────
    print("\n2. Vista previa de 3 chunks enriquecidos:")
    for chunk in chunks[:3]:
        texto_nuevo = enriquecer_texto(chunk)
        nombre = chunk.get("metadata", {}).get("nombre", chunk["id"])
        print(f"\n   [{nombre}]")
        print(f"   {texto_nuevo[:220]}...")

    confirmar = input("\n¿Proceder con la re-indexación completa? (s/N): ").strip().lower()
    if confirmar != "s":
        print("   Cancelado.")
        return

    # ── Conectar clientes ────────────────────────────────────────────────────
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    pc    = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index = pc.Index(PINECONE_INDEX)

    stats_antes = index.describe_index_stats()
    print(f"\n3. Pinecone '{PINECONE_INDEX}': {stats_antes.total_vector_count} vectores actuales")

    # ── Re-indexar por lotes ─────────────────────────────────────────────────
    print(f"\n4. Generando embeddings y subiendo ({len(chunks)} chunks)...")
    total_ok  = 0
    total_err = 0
    inicio    = time.time()

    for i in range(0, len(chunks), BATCH_SIZE):
        batch     = chunks[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        n_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"   Lote {batch_num}/{n_batches} ({len(batch)} chunks)...", end=" ", flush=True)

        try:
            # Texto enriquecido para el embedding
            textos = [enriquecer_texto(c) for c in batch]

            # Generar embeddings
            embeddings = generar_embeddings(textos, openai_client)

            # Preparar vectores
            vectors = []
            for j, chunk in enumerate(batch):
                meta_enriquecida = enriquecer_metadata(chunk)
                meta_enriquecida["text"] = textos[j][:800]  # guardar texto enriquecido

                vectors.append({
                    "id":     chunk["id"],
                    "values": embeddings[j],
                    "metadata": {k: v for k, v in meta_enriquecida.items() if v is not None},
                })

            index.upsert(vectors=vectors)
            total_ok += len(batch)
            print(f"✅ ({total_ok}/{len(chunks)})")
            time.sleep(0.3)

        except Exception as e:
            total_err += len(batch)
            print(f"❌ {e}")
            time.sleep(2)

    # ── Resultado ────────────────────────────────────────────────────────────
    time.sleep(2)
    stats_despues = index.describe_index_stats()
    duracion = time.time() - inicio

    print()
    print(SEP)
    print("  RESULTADO FINAL")
    print(SEP)
    print(f"  ✅ Subidos exitosamente: {total_ok}/{len(chunks)}")
    print(f"  ❌ Errores:              {total_err}")
    print(f"  ⏱  Tiempo total:         {duracion:.1f}s")
    print(f"  📌 Vectores antes:       {stats_antes.total_vector_count}")
    print(f"  📌 Vectores ahora:       {stats_despues.total_vector_count}")
    print()
    print("  Mejoras aplicadas:")
    print("   ✓ Sinónimos: olluco=papalisa, tarwi=chocho, kiwicha=amaranto...")
    print("   ✓ Carga Glucémica (CG = IG × carbs / 100)")
    print("   ✓ Clasificación IG: MUY BAJO / BAJO / MEDIO / ALTO")
    print(f"   ✓ Modelo: {EMBEDDING_MODEL} (más preciso que ada-002)")
    print()
    print("  Siguiente paso:")
    print("   → Reinicia el AI Service (uvicorn main:app --reload)")
    print("   → Prueba en el chat: '¿cuántas calorías tiene el olluco?'")
    print(SEP)


if __name__ == "__main__":
    main()
