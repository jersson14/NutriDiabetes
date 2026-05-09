"""
============================================================
CORREGIR ALIMENTOS FALTANTES EN TPCA 2025 + PINECONE
NutriDiabetes Perú | Tesis Maestría
============================================================
Agrega alimentos que no están en la TPCA 2025 pero SÍ
estaban en versiones anteriores del INS/MINSA y TPCA FAO/INCAP.

También corrige la ambigüedad lúcuma fresca vs harina de lúcuma.

Uso:
  cd scripts
  python corregir_alimentos_tpca.py
============================================================
"""

import json, os, sys, time
from dotenv import load_dotenv

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
BACKEND_ENV   = os.path.join(SCRIPT_DIR, "..", "backend", ".env")
AISERVICE_ENV = os.path.join(SCRIPT_DIR, "..", "ai-service", ".env")
if os.path.exists(BACKEND_ENV):   load_dotenv(BACKEND_ENV, override=False)
if os.path.exists(AISERVICE_ENV): load_dotenv(AISERVICE_ENV, override=True)

from openai import OpenAI
from pinecone import Pinecone

CHUNKS_PATH     = os.path.join(SCRIPT_DIR, "data", "pinecone_chunks.json")
EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
PINECONE_INDEX  = os.getenv("PINECONE_INDEX", "nutri-diabetes-peru")

# ============================================================
# 1. ALIMENTOS NUEVOS A AGREGAR
# Fuente: INS/MINSA TPCA edición anterior + FAO INCAP
# ============================================================
AGREGAR = [
    {
        "id": "manual_camote_amarillo_crudo",
        "metadata": {
            "nombre":              "Camote amarillo crudo",
            "nombre_comun":        "Camote, batata, boniato, sweet potato",
            "categoria":           "Raíces y tubérculos",
            "codigo_tpca":         "MANUAL-04",
            "energia_kcal":        105.0,
            "proteinas_g":         1.6,
            "carbohidratos_g":     24.3,
            "fibra_g":             3.0,
            "grasas_g":            0.3,
            "calcio_mg":           30.0,
            "hierro_mg":           0.6,
            "vitamina_c_mg":       22.7,
            "indice_glucemico":    54,
            "carga_glucemica":     round(54 * 24.3 / 100, 1),
            "nivel_recomendacion": "RECOMENDADO",
            "es_apto_diabeticos":  True,
            "sinonimos":           "batata, boniato, sweet potato, tubérculo andino",
            "fuente":              "INS/MINSA TPCA edición anterior + FAO INCAP",
            "nota":                "Camote fresco crudo sin procesar, no frito, no deshidratado",
        },
    },
    {
        "id": "manual_frijol_canario_crudo",
        "metadata": {
            "nombre":              "Frijol canario crudo",
            "nombre_comun":        "Fréjol canario, poroto, beans, legumbre, menestra",
            "categoria":           "Leguminosas y derivados",
            "codigo_tpca":         "MANUAL-05",
            "energia_kcal":        347.0,
            "proteinas_g":         22.6,
            "carbohidratos_g":     66.4,
            "fibra_g":             15.2,
            "grasas_g":            1.5,
            "calcio_mg":           135.0,
            "hierro_mg":           7.0,
            "vitamina_c_mg":       0.0,
            "indice_glucemico":    31,
            "carga_glucemica":     round(31 * 66.4 / 100, 1),
            "nivel_recomendacion": "RECOMENDADO",
            "es_apto_diabeticos":  True,
            "sinonimos":           "fréjol, poroto, menestra, legumbre, bean",
            "fuente":              "INS/MINSA TPCA edición anterior + FAO INCAP",
            "nota":                "Grano seco crudo, legumbre, menestra peruana, no es ají ni vegetal",
        },
    },
    {
        "id": "manual_lenteja_cruda",
        "metadata": {
            "nombre":              "Lenteja cruda",
            "nombre_comun":        "Lenteja, lens culinaris, legumbre, menestra",
            "categoria":           "Leguminosas y derivados",
            "codigo_tpca":         "MANUAL-06",
            "energia_kcal":        353.0,
            "proteinas_g":         25.8,
            "carbohidratos_g":     60.1,
            "fibra_g":             11.4,
            "grasas_g":            1.8,
            "calcio_mg":           51.0,
            "hierro_mg":           7.6,
            "vitamina_c_mg":       4.0,
            "indice_glucemico":    29,
            "carga_glucemica":     round(29 * 60.1 / 100, 1),
            "nivel_recomendacion": "RECOMENDADO",
            "es_apto_diabeticos":  True,
            "sinonimos":           "lentejas, lens culinaris, menestra, legumbre",
            "fuente":              "INS/MINSA TPCA edición anterior + FAO INCAP",
        },
    },
    {
        "id": "manual_lenteja_cocida",
        "metadata": {
            "nombre":              "Lenteja cocida",
            "nombre_comun":        "Lenteja hervida, lentejas guisadas, menestra cocida",
            "categoria":           "Leguminosas y derivados",
            "codigo_tpca":         "MANUAL-07",
            "energia_kcal":        114.0,
            "proteinas_g":         8.4,
            "carbohidratos_g":     19.5,
            "fibra_g":             4.0,
            "grasas_g":            0.6,
            "calcio_mg":           19.0,
            "hierro_mg":           2.4,
            "vitamina_c_mg":       1.5,
            "indice_glucemico":    29,
            "carga_glucemica":     round(29 * 19.5 / 100, 1),
            "nivel_recomendacion": "RECOMENDADO",
            "es_apto_diabeticos":  True,
            "sinonimos":           "lentejas hervidas, menestra, legumbre cocida",
            "fuente":              "INS/MINSA TPCA edición anterior + FAO INCAP",
        },
    },
    {
        "id": "manual_pollo_pechuga_cruda",
        "metadata": {
            "nombre":              "Pollo, pechuga de, sin piel, cruda",
            "nombre_comun":        "Pechuga de pollo fresca, chicken breast, carne blanca",
            "categoria":           "Carnes y derivados",
            "codigo_tpca":         "MANUAL-08",
            "energia_kcal":        121.0,
            "proteinas_g":         22.5,
            "carbohidratos_g":     0.0,
            "fibra_g":             0.0,
            "grasas_g":            2.8,
            "calcio_mg":           11.0,
            "hierro_mg":           0.7,
            "vitamina_c_mg":       0.0,
            "indice_glucemico":    0,
            "carga_glucemica":     0.0,
            "nivel_recomendacion": "RECOMENDADO",
            "es_apto_diabeticos":  True,
            "sinonimos":           "pechuga de pollo, chicken breast, carne blanca",
            "fuente":              "INS/MINSA TPCA edición anterior + FAO INCAP",
            "nota":                "Pechuga cruda sin piel sin freír, proteína magra baja en grasa",
        },
    },
]

# ============================================================
# 2. CHUNKS EXISTENTES A ACTUALIZAR
# Corrección de la ambigüedad lúcuma fresca vs harina de lúcuma
# ============================================================
ACTUALIZAR = {
    "c_35": {
        "sufijo_texto": (
            " Lúcuma fresca entera fruto natural sin procesar. "
            "IG 25 bajo. RECOMENDADO para DM2 como postre natural. "
            "No confundir con lúcuma en polvo ni harina de lúcuma."
        ),
        "metadata_extra": {
            "sinonimos": "lúcuma fruta fresca, pouteria lucuma, fruta andina",
            "nota":      "Fruta fresca entera, no procesada, no deshidratada",
        },
    },
    "c_36": {
        "sufijo_texto": (
            " Harina de lúcuma deshidratada procesada en polvo. "
            "No es la fruta fresca. Para consultas de lúcuma FRESCA ver c_35."
        ),
        "metadata_extra": {
            "nota": "Lúcuma procesada deshidratada en polvo, no fruta fresca",
        },
    },
    # Enriquecer camote hojuela para que no confunda con camote fresco
    "l_35": {
        "sufijo_texto": (
            " Producto procesado industrialmente: hojuela chips frita en aceite. "
            "NO es camote fresco crudo. Para camote fresco ver manual_camote_amarillo_crudo."
        ),
        "metadata_extra": {
            "nota": "Producto ultraprocesado frito, no es camote fresco crudo",
        },
    },
    # Pechuga frita — distinguir de pechuga fresca
    "f_83": {
        "sufijo_texto": (
            " Pechuga frita en aceite, versión procesada. "
            "Para pechuga fresca cruda sin freír ver manual_pollo_pechuga_cruda."
        ),
        "metadata_extra": {
            "nota": "Frita en aceite vegetal, no es pechuga cruda sin procesar",
        },
    },
}

# ============================================================
# HELPERS
# ============================================================
def clasif_ig(ig):
    if ig <= 0:  return ""
    if ig <= 40: return "MUY BAJO"
    if ig <= 55: return "BAJO"
    if ig <= 69: return "MEDIO"
    return "ALTO"

def construir_texto(a: dict) -> str:
    m = a["metadata"]
    nom  = m["nombre"]
    com  = m.get("nombre_comun", "")
    cat  = m.get("categoria", "")
    ig   = m.get("indice_glucemico", 0)
    carbs= m.get("carbohidratos_g", 0)
    cg   = m.get("carga_glucemica", 0)
    rec  = m.get("nivel_recomendacion", "")
    nota = m.get("nota", "")

    partes = [
        f"Alimento peruano: {nom}.",
        f"También conocido como: {com}." if com else "",
        f"Categoría: {cat}.",
        f"Composición por 100g: "
        f"Energía {m.get('energia_kcal',0)} kcal. "
        f"Proteínas {m.get('proteinas_g',0)}g. "
        f"Grasas {m.get('grasas_g',0)}g. "
        f"Carbohidratos {carbs}g. "
        f"Fibra {m.get('fibra_g',0)}g.",
    ]
    if ig > 0:
        clasig = clasif_ig(float(ig))
        clasig_cg = "BAJA" if cg < 10 else ("MEDIA" if cg < 20 else "ALTA")
        partes.append(
            f"Índice Glucémico (IG): {ig} — {clasig}. "
            f"Carga Glucémica (CG): {cg} — {clasig_cg}."
        )
    partes.append(f"Clasificación DM2: {rec}.")
    if nota:
        partes.append(nota)
    partes.append(f"Fuente: {m.get('fuente','INS/MINSA + FAO INCAP')}. "
                  f"Nota: dato no incluido en TPCA 2025 CENAN/INS.")
    return " ".join(p for p in partes if p)


def main():
    SEP = "=" * 65
    print(SEP)
    print("  CORREGIR ALIMENTOS TPCA — NutriDiabetes Perú")
    print(SEP)

    for var in ["OPENAI_API_KEY", "PINECONE_API_KEY"]:
        if not os.getenv(var):
            print(f"❌ {var} no configurada")
            return

    with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    ids_existentes = {c["id"]: i for i, c in enumerate(chunks)}
    print(f"\nChunks actuales: {len(chunks)}")

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    pc     = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index  = pc.Index(PINECONE_INDEX)

    vectores_upsert = []

    # ── 1. Agregar nuevos ────────────────────────────────────────────────────
    nuevos = []
    for a in AGREGAR:
        if a["id"] in ids_existentes:
            print(f"   ⏭  Ya existe: {a['metadata']['nombre']}")
            continue
        texto = construir_texto(a)
        chunk = {"id": a["id"], "text": texto, "metadata": {**a["metadata"]}}
        chunks.append(chunk)
        nuevos.append((chunk, texto))
        print(f"   ➕ Nuevo: {a['metadata']['nombre']}")

    if nuevos:
        textos_n     = [t for _, t in nuevos]
        resp         = client.embeddings.create(model=EMBEDDING_MODEL, input=textos_n)
        embeddings_n = [item.embedding for item in resp.data]
        for (chunk, texto), emb in zip(nuevos, embeddings_n):
            meta = dict(chunk["metadata"])
            meta["text"] = texto[:800]
            vectores_upsert.append({"id": chunk["id"], "values": emb,
                                    "metadata": {k: v for k, v in meta.items() if v is not None}})

    # ── 2. Actualizar existentes ─────────────────────────────────────────────
    print()
    textos_act   = []
    ids_act      = []
    for chunk_id, cambios in ACTUALIZAR.items():
        if chunk_id not in ids_existentes:
            print(f"   ⚠️  No encontrado en JSON: {chunk_id}")
            continue
        idx    = ids_existentes[chunk_id]
        chunk  = chunks[idx]
        texto_original = chunk.get("text", "")
        texto_nuevo    = texto_original.rstrip(" .") + cambios["sufijo_texto"]
        chunk["text"]  = texto_nuevo
        chunk["metadata"].update(cambios.get("metadata_extra", {}))
        textos_act.append(texto_nuevo)
        ids_act.append(chunk_id)
        print(f"   ✏️  Actualizado: {chunk_id} — {chunk['metadata'].get('nombre')}")

    if textos_act:
        resp         = client.embeddings.create(model=EMBEDDING_MODEL, input=textos_act)
        embeddings_a = [item.embedding for item in resp.data]
        for chunk_id, texto, emb in zip(ids_act, textos_act, embeddings_a):
            idx  = ids_existentes[chunk_id]
            meta = dict(chunks[idx]["metadata"])
            meta["text"] = texto[:800]
            vectores_upsert.append({"id": chunk_id, "values": emb,
                                    "metadata": {k: v for k, v in meta.items() if v is not None}})

    # ── 3. Subir a Pinecone ──────────────────────────────────────────────────
    if vectores_upsert:
        print(f"\nSubiendo {len(vectores_upsert)} vectores a Pinecone...")
        for i in range(0, len(vectores_upsert), 50):
            index.upsert(vectors=vectores_upsert[i:i+50])
        print(f"✅ {len(vectores_upsert)} vectores actualizados")

    # ── 4. Guardar JSON ──────────────────────────────────────────────────────
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    time.sleep(2)
    stats = index.describe_index_stats()
    print(f"📌 Vectores en Pinecone: {stats.total_vector_count}")
    print(f"📄 Chunks en JSON:       {len(chunks)}")
    print()
    print(SEP)
    print("  LISTO. Prueba:")
    print("   curl ...camote amarillo crudo...  → debe dar ~105 kcal")
    print("   curl ...frijol canario crudo...   → debe dar ~347 kcal")
    print("   curl ...lenteja cruda...          → debe dar ~353 kcal")
    print("   curl ...lúcuma fresca...          → debe dar ~97 kcal")
    print("   curl ...pechuga pollo sin piel... → debe dar ~121 kcal")
    print(SEP)


if __name__ == "__main__":
    main()
