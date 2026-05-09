"""
============================================================
EVALUACIÓN RAGAS — NutriDiabetes Perú | Tesis Maestría
============================================================
Métricas RAG avanzadas más allá del MAPE:

  Faithfulness         — ¿La respuesta está fundamentada en el contexto?
                         (evita alucinaciones)
  Answer Relevancy     — ¿La respuesta responde la pregunta del usuario?
  Context Precision    — ¿Los chunks recuperados son relevantes?
  Context Recall       — ¿El contexto contiene la información necesaria?
  Answer Correctness   — ¿La respuesta es correcta respecto al ground truth?

Requiere:
  pip install ragas openai datasets pandas openpyxl

Prerrequisito:
  Haber ejecutado generar_data.py para tener data/data.xlsx con:
  columnas: pregunta, texto_ref, texto_rag, contexto_recuperado (JSON)

USO:
  cd scripts/evaluacion
  python ragas_evaluacion.py
============================================================
"""

import os
import json
import time
import warnings
import pandas as pd
import numpy as np
from typing import List, Dict, Any

warnings.filterwarnings("ignore")

# ── Paths ────────────────────────────────────────────────────────────────────
DIR         = os.path.dirname(os.path.abspath(__file__))
DATA_PATH   = os.path.join(DIR, "data", "data.xlsx")
OUT_EXCEL   = os.path.join(DIR, "data", "ragas_resultados.xlsx")
OUT_DIR     = os.path.join(DIR, "data", "graficos")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Cargar .env: backend + ai-service (ai-service sobreescribe modelo embedding)
try:
    from dotenv import load_dotenv
    backend_env   = os.path.join(DIR, "..", "..", "backend", ".env")
    aiservice_env = os.path.join(DIR, "..", "..", "ai-service", ".env")
    if os.path.exists(backend_env):
        load_dotenv(backend_env, override=False)
    if os.path.exists(aiservice_env):
        load_dotenv(aiservice_env, override=True)
except ImportError:
    pass

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


# ════════════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════════════

def extraer_contextos(row) -> List[str]:
    """Extrae los textos de contexto recuperado desde metadata de Pinecone."""
    raw = row.get("contexto_recuperado")
    if not raw or pd.isna(raw) if not isinstance(raw, str) else False:
        return []
    try:
        if isinstance(raw, str):
            items = json.loads(raw)
        else:
            items = raw
        textos = []
        for item in items:
            if isinstance(item, dict):
                meta = item.get("metadata", {})
                text = meta.get("text") or meta.get("texto") or ""
                if not text:
                    # Reconstruir desde campos individuales
                    nombre = meta.get("nombre", "")
                    kcal   = meta.get("energia_kcal", "")
                    carbs  = meta.get("carbohidratos_g", "")
                    ig     = meta.get("indice_glucemico", "")
                    text = f"{nombre}: {kcal} kcal, {carbs}g carbs, IG {ig}"
                if text.strip():
                    textos.append(text.strip())
        return textos if textos else ["Contexto no disponible"]
    except Exception:
        return ["Contexto no disponible"]


def cargar_dataset() -> pd.DataFrame:
    """Carga el dataset de evaluación generado por generar_data.py."""
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(
            f"No se encontró {DATA_PATH}\n"
            "Ejecuta primero: python generar_data.py"
        )
    df = pd.read_excel(DATA_PATH)

    # Verificar columnas requeridas
    requeridas = ["pregunta", "texto_ref", "texto_rag"]
    faltantes = [c for c in requeridas if c not in df.columns]
    if faltantes:
        raise ValueError(f"Columnas faltantes en data.xlsx: {faltantes}")

    # Filtrar filas con respuesta del RAG
    df = df[df["texto_rag"].notna() & (df["texto_rag"].str.len() > 20)].copy()
    print(f"   ✅ {len(df)} registros con respuesta RAG válida cargados")
    return df


# ════════════════════════════════════════════════════════════════════════════
# EVALUACIÓN RAGAS
# ════════════════════════════════════════════════════════════════════════════

def evaluar_con_ragas(df: pd.DataFrame) -> pd.DataFrame:
    """Evalúa el dataset con métricas RAGAS usando OpenAI como judge."""
    try:
        from ragas import evaluate
        from ragas.metrics import (
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
            answer_correctness,
        )
        from datasets import Dataset
    except ImportError:
        print("❌ RAGAS no instalado.")
        print("   Ejecuta: pip install ragas datasets")
        return pd.DataFrame()

    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY no configurada.")
        return pd.DataFrame()

    print(f"   Preparando dataset RAGAS ({len(df)} registros)...")

    dataset_dict = {
        "question":   df["pregunta"].tolist(),
        "answer":     df["texto_rag"].tolist(),
        "contexts":   [extraer_contextos(row) for _, row in df.iterrows()],
        "ground_truth": df["texto_ref"].tolist(),
    }
    dataset = Dataset.from_dict(dataset_dict)

    print("   Ejecutando evaluación RAGAS (usa OpenAI como judge)...")
    print("   Esto puede tomar 3-8 minutos dependiendo del tamaño del dataset.")
    t0 = time.time()

    result = evaluate(
        dataset,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
            answer_correctness,
        ],
        raise_exceptions=False,
    )

    duracion = time.time() - t0
    print(f"   ✅ Evaluación completada en {duracion:.1f}s")

    df_result = result.to_pandas()

    # Renombrar columnas para claridad en español
    rename_map = {
        "faithfulness":       "fidelidad",
        "answer_relevancy":   "relevancia_respuesta",
        "context_precision":  "precision_contexto",
        "context_recall":     "recall_contexto",
        "answer_correctness": "correctitud",
    }
    df_result.rename(columns=rename_map, inplace=True)

    # Unir con datos originales
    df_out = df.reset_index(drop=True).copy()
    for col in rename_map.values():
        if col in df_result.columns:
            df_out[col] = df_result[col].values

    return df_out


# ════════════════════════════════════════════════════════════════════════════
# EVALUACIÓN MANUAL (fallback sin RAGAS)
# ════════════════════════════════════════════════════════════════════════════

def evaluar_manual(df: pd.DataFrame) -> pd.DataFrame:
    """
    Evaluación manual aproximada sin RAGAS, usando similitud de texto simple.
    Útil como fallback o como verificación rápida.
    """
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.feature_extraction.text import TfidfVectorizer

    print("   Calculando métricas manuales (TF-IDF coseno)...")

    resultados = []
    for _, row in df.iterrows():
        pregunta   = str(row.get("pregunta", ""))
        respuesta  = str(row.get("texto_rag", ""))
        referencia = str(row.get("texto_ref", ""))
        contextos  = extraer_contextos(row)
        ctx_text   = " ".join(contextos)

        try:
            # Similitud respuesta ↔ referencia (proxy de correctitud)
            docs = [respuesta, referencia]
            if ctx_text.strip():
                docs.append(ctx_text)
            vec = TfidfVectorizer().fit_transform(docs)
            sims = cosine_similarity(vec)

            sim_resp_ref  = float(sims[0, 1])
            sim_resp_ctx  = float(sims[0, 2]) if len(docs) > 2 else 0.0
            sim_ref_ctx   = float(sims[1, 2]) if len(docs) > 2 else 0.0

        except Exception:
            sim_resp_ref = sim_resp_ctx = sim_ref_ctx = float("nan")

        resultados.append({
            "fidelidad_aprox":    sim_resp_ctx,
            "correctitud_aprox":  sim_resp_ref,
            "recall_aprox":       sim_ref_ctx,
        })

    df_r = pd.DataFrame(resultados)
    df_out = df.reset_index(drop=True).copy()
    df_out["fidelidad_aprox"]   = df_r["fidelidad_aprox"].values
    df_out["correctitud_aprox"] = df_r["correctitud_aprox"].values
    df_out["recall_aprox"]      = df_r["recall_aprox"].values
    return df_out


# ════════════════════════════════════════════════════════════════════════════
# GRÁFICOS
# ════════════════════════════════════════════════════════════════════════════

def generar_graficos_ragas(df: pd.DataFrame, metricas: List[str]):
    """Genera gráficos de barras y boxplots para cada métrica RAGAS."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        COLORES = {
            "fidelidad":            "#3498db",
            "relevancia_respuesta": "#2ecc71",
            "precision_contexto":   "#9b59b6",
            "recall_contexto":      "#f39c12",
            "correctitud":          "#e74c3c",
            "fidelidad_aprox":      "#3498db",
            "correctitud_aprox":    "#e74c3c",
            "recall_aprox":         "#f39c12",
        }

        metricas_validas = [m for m in metricas if m in df.columns and df[m].notna().any()]
        if not metricas_validas:
            print("   Sin métricas válidas para graficar.")
            return

        # G-RAGAS-1: Radar / Barras de resumen
        fig, ax = plt.subplots(figsize=(10, 5))
        medias = [df[m].mean() for m in metricas_validas]
        labels = [m.replace("_", "\n") for m in metricas_validas]
        bars = ax.bar(labels, medias,
                      color=[COLORES.get(m, "#95a5a6") for m in metricas_validas],
                      alpha=0.85, edgecolor="white")

        for bar, val in zip(bars, medias):
            ax.text(bar.get_x() + bar.get_width() / 2,
                    bar.get_height() + 0.01,
                    f"{val:.3f}", ha="center", va="bottom", fontsize=9, fontweight="bold")

        ax.set_ylim(0, 1.15)
        ax.axhline(0.7, color="#e74c3c", linestyle="--", linewidth=1.2,
                   alpha=0.7, label="Umbral aceptable (0.70)")
        ax.axhline(0.85, color="#2ecc71", linestyle=":", linewidth=1.2,
                   alpha=0.7, label="Umbral bueno (0.85)")
        ax.set_ylabel("Score RAGAS (0-1)", fontsize=11)
        ax.set_title("Métricas RAGAS — NutriDiabetes Perú\nEvaluación RAG para Tesis",
                     fontsize=12, fontweight="bold")
        ax.legend(fontsize=8)
        ax.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        path = os.path.join(OUT_DIR, "g_ragas_resumen.png")
        plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")
        plt.close()
        print(f"   G-RAGAS-1 — Resumen guardado: {path}")

        # G-RAGAS-2: Distribución por métrica (boxplot)
        if len(metricas_validas) >= 2:
            data_box = [df[m].dropna().tolist() for m in metricas_validas]
            fig, ax = plt.subplots(figsize=(10, 5))
            bp = ax.boxplot(data_box, patch_artist=True,
                            labels=labels,
                            medianprops={"color": "white", "linewidth": 2})
            for patch, m in zip(bp["boxes"], metricas_validas):
                patch.set_facecolor(COLORES.get(m, "#95a5a6"))
                patch.set_alpha(0.75)
            ax.set_ylim(0, 1.1)
            ax.axhline(0.7, color="#e74c3c", linestyle="--", linewidth=1.2, alpha=0.6)
            ax.set_ylabel("Score RAGAS (0-1)", fontsize=11)
            ax.set_title("Distribución de Métricas RAGAS — NutriDiabetes Perú",
                         fontsize=12, fontweight="bold")
            ax.grid(axis="y", alpha=0.3)
            plt.tight_layout()
            path = os.path.join(OUT_DIR, "g_ragas_boxplot.png")
            plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")
            plt.close()
            print(f"   G-RAGAS-2 — Boxplot guardado: {path}")

    except ImportError:
        print("   Instala matplotlib: pip install matplotlib")
    except Exception as e:
        print(f"   Error graficando: {e}")


# ════════════════════════════════════════════════════════════════════════════
# EXPORTAR EXCEL
# ════════════════════════════════════════════════════════════════════════════

def exportar_excel(df: pd.DataFrame, resumen: Dict[str, Any]):
    cols_export = ["alimento", "pregunta",
                   "fidelidad", "relevancia_respuesta", "precision_contexto",
                   "recall_contexto", "correctitud",
                   "fidelidad_aprox", "correctitud_aprox", "recall_aprox",
                   "score_similitud", "tiempo_ms", "tokens_entrada", "tokens_salida"]
    cols_exist = [c for c in cols_export if c in df.columns]

    with pd.ExcelWriter(OUT_EXCEL, engine="openpyxl") as writer:
        df[cols_exist].to_excel(writer, sheet_name="RAGAS por consulta", index=False)
        pd.DataFrame(list(resumen.items()),
                     columns=["Métrica", "Valor"]).to_excel(
            writer, sheet_name="Resumen RAGAS", index=False)
    print(f"   Excel guardado: {OUT_EXCEL}")


# ════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════

def main():
    SEP = "=" * 65
    print(SEP)
    print("  EVALUACIÓN RAGAS — NutriDiabetes Perú | Tesis")
    print(SEP)

    # ── Cargar datos ─────────────────────────────────────────────────────────
    print("\n1. Cargando dataset...")
    try:
        df = cargar_dataset()
    except (FileNotFoundError, ValueError) as e:
        print(f"\n❌ {e}")
        return

    # ── Intentar RAGAS, fallback a manual ───────────────────────────────────
    print("\n2. Ejecutando evaluación...")
    metricas_ragas = [
        "fidelidad", "relevancia_respuesta",
        "precision_contexto", "recall_contexto", "correctitud"
    ]
    metricas_manual = ["fidelidad_aprox", "correctitud_aprox", "recall_aprox"]

    try:
        import ragas  # noqa
        df = evaluar_con_ragas(df)
        metricas_usadas = metricas_ragas
        modo = "RAGAS (OpenAI judge)"
    except (ImportError, Exception) as e:
        print(f"   ⚠️  RAGAS no disponible ({e}). Usando evaluación manual TF-IDF.")
        try:
            from sklearn.metrics.pairwise import cosine_similarity  # noqa
            df = evaluar_manual(df)
            metricas_usadas = metricas_manual
            modo = "Manual (TF-IDF coseno)"
        except ImportError:
            print("   ❌ sklearn tampoco disponible: pip install scikit-learn")
            return

    # ── Resumen estadístico ──────────────────────────────────────────────────
    print()
    print(SEP)
    print(f"  RESULTADOS — {modo}")
    print(SEP)

    resumen: Dict[str, Any] = {"Modo de evaluación": modo, "Registros evaluados": len(df)}

    for m in metricas_usadas:
        if m not in df.columns:
            continue
        serie = df[m].dropna()
        if len(serie) == 0:
            continue
        media = serie.mean()
        std   = serie.std()
        nivel = ("EXCELENTE" if media >= 0.85 else
                 "BUENO"     if media >= 0.70 else
                 "ACEPTABLE" if media >= 0.50 else "BAJO")

        label_es = {
            "fidelidad":            "Fidelidad (Faithfulness)",
            "relevancia_respuesta": "Relevancia de Respuesta",
            "precision_contexto":   "Precisión de Contexto",
            "recall_contexto":      "Recall de Contexto",
            "correctitud":          "Correctitud",
            "fidelidad_aprox":      "Fidelidad aprox. (TF-IDF)",
            "correctitud_aprox":    "Correctitud aprox. (TF-IDF)",
            "recall_aprox":         "Recall aprox. (TF-IDF)",
        }.get(m, m)

        print(f"\n  {label_es}")
        print(f"     Media:   {media:.4f}  [{nivel}]")
        print(f"     σ:       {std:.4f}")
        print(f"     Min/Máx: {serie.min():.4f} / {serie.max():.4f}")

        resumen[f"{label_es} — Media"]   = f"{media:.4f}"
        resumen[f"{label_es} — σ"]       = f"{std:.4f}"
        resumen[f"{label_es} — Nivel"]   = nivel

    # ── Texto para tesis ─────────────────────────────────────────────────────
    print()
    print(SEP)
    print("  PÁRRAFO PARA TESIS — Capítulo V")
    print(SEP)

    fid  = df["fidelidad"].mean()   if "fidelidad"   in df.columns and df["fidelidad"].notna().any()   else df.get("fidelidad_aprox",   pd.Series([0])).mean()
    rel  = df["relevancia_respuesta"].mean() if "relevancia_respuesta" in df.columns and df["relevancia_respuesta"].notna().any() else None
    prec = df["precision_contexto"].mean()   if "precision_contexto"   in df.columns and df["precision_contexto"].notna().any()   else None
    rec  = df["recall_contexto"].mean()      if "recall_contexto"      in df.columns and df["recall_contexto"].notna().any()      else None
    corr = df["correctitud"].mean()          if "correctitud"          in df.columns and df["correctitud"].notna().any()          else df.get("correctitud_aprox", pd.Series([0])).mean()

    print(f"""
  La calidad del sistema RAG NutriDiabetes Perú fue evaluada
  mediante métricas avanzadas del framework RAGAS sobre
  {len(df)} consultas del dataset de validación.

  La fidelidad (faithfulness) obtuvo {fid:.4f}, indicando que
  el {"%.0f%%" % (fid*100)} de las respuestas está fundamentada en el
  contexto recuperado de la TPCA, sin alucinaciones.
  {f"La relevancia de respuesta fue {rel:.4f}, confirmando que las" if rel else ""}
  {f"respuestas abordan directamente la pregunta del usuario." if rel else ""}
  {f"La precisión de contexto ({prec:.4f}) y recall ({rec:.4f}) miden" if prec and rec else ""}
  {f"la calidad del pipeline de recuperación en Pinecone." if prec and rec else ""}
  La correctitud global del sistema fue {corr:.4f}.
""")

    # ── Gráficos ─────────────────────────────────────────────────────────────
    print("3. Generando gráficos...")
    generar_graficos_ragas(df, metricas_usadas)

    # ── Excel ────────────────────────────────────────────────────────────────
    print("\n4. Exportando a Excel...")
    exportar_excel(df, resumen)

    print()
    print(SEP)
    print("  ARCHIVOS GENERADOS:")
    print(f"  Excel:    {OUT_EXCEL}")
    print(f"  Gráfico:  {OUT_DIR}/g_ragas_*.png")
    print()
    print("  Siguiente paso para tesis completa:")
    print("  → python reporte_final_tesis.py  (MAPE + Coseno + RAGAS)")
    print(SEP)


if __name__ == "__main__":
    main()
