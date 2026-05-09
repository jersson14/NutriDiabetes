"""
============================================================
AGREGAR ALIMENTOS MANUALMENTE A PINECONE
NutriDiabetes Perú | Tesis Maestría
============================================================
Para alimentos que no están en la TPCA 2025 pero sí en
fuentes oficiales secundarias: INS/MINSA versiones anteriores,
FAO, INCAP, o estudios peruanos validados.

Uso:
  cd scripts
  python agregar_alimentos_manual.py
============================================================
"""

import json
import os
import time
from dotenv import load_dotenv

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
BACKEND_ENV   = os.path.join(SCRIPT_DIR, "..", "backend", ".env")
AISERVICE_ENV = os.path.join(SCRIPT_DIR, "..", "ai-service", ".env")

if os.path.exists(BACKEND_ENV):
    load_dotenv(BACKEND_ENV, override=False)
if os.path.exists(AISERVICE_ENV):
    load_dotenv(AISERVICE_ENV, override=True)

from openai import OpenAI
from pinecone import Pinecone

CHUNKS_PATH     = os.path.join(SCRIPT_DIR, "data", "pinecone_chunks.json")
EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
PINECONE_INDEX  = os.getenv("PINECONE_INDEX", "nutri-diabetes-peru")

# ============================================================
# ALIMENTOS A AGREGAR
# Fuentes: INS/MINSA TPCA ediciones anteriores, FAO/INCAP,
#          estudios peruanos de composición de alimentos
# ============================================================
ALIMENTOS_NUEVOS = [
    {
        "id": "manual_olluco_001",
        "fuente_datos": "INS/MINSA TPCA edición anterior + FAO",
        "metadata": {
            "nombre":              "Olluco crudo",
            "nombre_comun":        "Papalisa, ulluco, melloco",
            "categoria":           "Raíces y tubérculos andinos",
            "codigo_tpca":         "MANUAL-01",
            "energia_kcal":        57.0,
            "proteinas_g":         1.1,
            "carbohidratos_g":     13.4,
            "fibra_g":             1.0,
            "grasas_g":            0.1,
            "calcio_mg":           3.0,
            "hierro_mg":           0.5,
            "vitamina_c_mg":       11.0,
            "indice_glucemico":    50,
            "carga_glucemica":     round(50 * 13.4 / 100, 1),   # 6.7
            "nivel_recomendacion": "MODERADO",
            "es_apto_diabeticos":  True,
            "sinonimos":           "papalisa, ulluco, melloco, ullucu, tubérculo andino",
            "fuente":              "INS/MINSA TPCA (edición anterior) + FAO INCAP",
        },
    },
    {
        "id": "manual_oca_001",
        "fuente_datos": "FAO/INCAP + estudios peruanos",
        "metadata": {
            "nombre":              "Oca cruda",
            "nombre_comun":        "Okka, oxalis tuberosa",
            "categoria":           "Raíces y tubérculos andinos",
            "codigo_tpca":         "MANUAL-02",
            "energia_kcal":        36.0,
            "proteinas_g":         0.9,
            "carbohidratos_g":     8.2,
            "fibra_g":             1.0,
            "grasas_g":            0.1,
            "calcio_mg":           6.0,
            "hierro_mg":           0.3,
            "vitamina_c_mg":       37.0,
            "indice_glucemico":    35,
            "carga_glucemica":     round(35 * 8.2 / 100, 1),    # 2.9
            "nivel_recomendacion": "RECOMENDADO",
            "es_apto_diabeticos":  True,
            "sinonimos":           "okka, tubérculo andino, oxalis tuberosa",
            "fuente":              "FAO/INCAP + CIP Centro Internacional de la Papa",
        },
    },
    {
        "id": "manual_mashua_001",
        "fuente_datos": "CIP + estudios peruanos",
        "metadata": {
            "nombre":              "Mashua cruda",
            "nombre_comun":        "Mashwa, cubio, isaño",
            "categoria":           "Raíces y tubérculos andinos",
            "codigo_tpca":         "MANUAL-03",
            "energia_kcal":        52.0,
            "proteinas_g":         1.5,
            "carbohidratos_g":     12.0,
            "fibra_g":             1.2,
            "grasas_g":            0.2,
            "calcio_mg":           14.0,
            "hierro_mg":           0.7,
            "vitamina_c_mg":       77.0,
            "indice_glucemico":    40,
            "carga_glucemica":     round(40 * 12.0 / 100, 1),   # 4.8
            "nivel_recomendacion": "RECOMENDADO",
            "es_apto_diabeticos":  True,
            "sinonimos":           "mashwa, cubio, isaño, tubérculo andino",
            "fuente":              "CIP Centro Internacional de la Papa + FAO",
        },
    },
]


def construir_texto(alimento_data: dict) -> str:
    """Genera texto descriptivo enriquecido para el embedding."""
    m    = alimento_data["metadata"]
    src  = alimento_data["fuente_datos"]
    nom  = m["nombre"]
    com  = m.get("nombre_comun", "")
    cat  = m.get("categoria", "")
    ig   = m.get("indice_glucemico", 0)
    carbs = m.get("carbohidratos_g", 0)
    cg   = m.get("carga_glucemica", 0)
    rec  = m.get("nivel_recomendacion", "")

    clasif_ig = (
        "MUY BAJO" if ig <= 40 else
        "BAJO"     if ig <= 55 else
        "MEDIO"    if ig <= 69 else "ALTO"
    )
    clasif_cg = "BAJA" if cg < 10 else ("MEDIA" if cg < 20 else "ALTA")

    partes = [
        f"Alimento peruano: {nom}.",
        f"También conocido como: {com}." if com else "",
        f"Categoría: {cat}.",
        f"Composición por 100g de porción comestible:",
        f"Energía {m.get('energia_kcal', 0)} kcal.",
        f"Proteínas {m.get('proteinas_g', 0)}g.",
        f"Grasas {m.get('grasas_g', 0)}g.",
        f"Carbohidratos totales {carbs}g.",
        f"Fibra dietaria {m.get('fibra_g', 0)}g." if m.get("fibra_g") else "",
        f"Calcio {m.get('calcio_mg', 0)}mg." if m.get("calcio_mg") else "",
        f"Hierro {m.get('hierro_mg', 0)}mg." if m.get("hierro_mg") else "",
        f"Vitamina C {m.get('vitamina_c_mg', 0)}mg." if m.get("vitamina_c_mg") else "",
        f"Índice Glucémico (IG): {ig} — {clasif_ig}.",
        f"Carga Glucémica (CG): {cg} — {clasif_cg} (CG = IG × carbohidratos / 100).",
        f"Clasificación DM2: {rec}.",
        f"{'Apto' if m.get('es_apto_diabeticos') else 'Consumir con precaución'} para pacientes con diabetes mellitus tipo 2.",
        f"Fuente: {m.get('fuente', src)}. Nota: dato no incluido en TPCA 2025 CENAN/INS.",
    ]
    return " ".join(p for p in partes if p)


def main():
    SEP = "=" * 65
    print(SEP)
    print("  AGREGAR ALIMENTOS MANUALMENTE — NutriDiabetes Perú")
    print(SEP)

    for var in ["OPENAI_API_KEY", "PINECONE_API_KEY"]:
        if not os.getenv(var):
            print(f"❌ {var} no configurada")
            return

    # ── Leer JSON existente ──────────────────────────────────────────────────
    with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    ids_existentes = {c["id"] for c in chunks}
    print(f"\nChunks actuales en JSON: {len(chunks)}")

    # ── Construir nuevos chunks ──────────────────────────────────────────────
    nuevos = []
    for alimento in ALIMENTOS_NUEVOS:
        aid = alimento["id"]
        nombre = alimento["metadata"]["nombre"]
        if aid in ids_existentes:
            print(f"   ⏭  Ya existe: {nombre} ({aid})")
            continue
        texto = construir_texto(alimento)
        chunk = {
            "id":       aid,
            "text":     texto,
            "metadata": {k: v for k, v in alimento["metadata"].items() if v is not None},
        }
        nuevos.append(chunk)
        print(f"   ➕ Nuevo: {nombre}")

    if not nuevos:
        print("\nTodos los alimentos ya existen. Nada que agregar.")
        return

    print(f"\nTexto de ejemplo para '{nuevos[0]['metadata']['nombre']}':")
    print(f"   {nuevos[0]['text'][:250]}...")

    confirmar = input(f"\n¿Agregar {len(nuevos)} alimento(s) al JSON y Pinecone? (s/N): ").strip().lower()
    if confirmar != "s":
        print("Cancelado.")
        return

    # ── Generar embeddings ───────────────────────────────────────────────────
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    pc     = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index  = pc.Index(PINECONE_INDEX)

    print(f"\nGenerando embeddings ({EMBEDDING_MODEL})...")
    textos     = [c["text"] for c in nuevos]
    response   = client.embeddings.create(model=EMBEDDING_MODEL, input=textos)
    embeddings = [item.embedding for item in response.data]

    # ── Subir a Pinecone ─────────────────────────────────────────────────────
    vectors = []
    for chunk, emb in zip(nuevos, embeddings):
        meta = dict(chunk["metadata"])
        meta["text"] = chunk["text"][:800]
        vectors.append({"id": chunk["id"], "values": emb, "metadata": meta})

    index.upsert(vectors=vectors)
    print(f"✅ {len(vectors)} vectores subidos a Pinecone")

    # ── Actualizar JSON ──────────────────────────────────────────────────────
    chunks.extend(nuevos)
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)
    print(f"✅ JSON actualizado: {len(chunks)} chunks totales")

    # ── Verificar ────────────────────────────────────────────────────────────
    time.sleep(2)
    stats = index.describe_index_stats()
    print(f"📌 Vectores en Pinecone ahora: {stats.total_vector_count}")

    print()
    print(SEP)
    print("  LISTO — Prueba en el chat:")
    for a in nuevos:
        nom = a["metadata"]["nombre"]
        print(f"   -> 'cuantas calorias tiene el {nom}?'")
    print(SEP)


if __name__ == "__main__":
    main()
