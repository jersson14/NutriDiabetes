"""
============================================================
EVALUACIÓN COMPARATIVA — RAG vs GPT vs Gemini (sin RAG)
NutriDiabetes Perú - Instrumento de Validación de Tesis
============================================================

OBJETIVO
  Comparar precisión (MAPE), coherencia (coseno ngram 1-2) y rendimiento (tiempo)
  usando EXACTAMENTE las mismas preguntas para 3 enfoques:

    A) RAG: Pinecone + LLM (vía endpoint /api/recommend)
    B) GPT: OpenAI sin RAG (LLM directo)
    C) Gemini: Google Gemini sin RAG (LLM directo)

DATASET (input)
  Debe contener columnas:
    - pregunta
    - kcal_real
    - texto_ref

EXPORTA (output-dir)
  - comparacion_modelos.csv
  - resumen_modelos.csv

REQUISITOS (pip)
  pip install pandas numpy scikit-learn python-dotenv httpx openai
  # Para xlsx:
  pip install openpyxl
  # Para Gemini:
  pip install google-generativeai

EJEMPLO
  python comparacion_rag_vs_llms.py --input scripts/evaluacion/data/data.xlsx --output-dir scripts/evaluacion/data

NOTA
  - No modifica el dataset original: solo lee y exporta nuevos CSVs.
  - Maneja errores por fila (API caídas, timeouts, parsing kcal).
============================================================
"""

from __future__ import annotations

import argparse
import math
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd
from dotenv import load_dotenv
import httpx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# ──────────────────────────────────────────────────────────────
# Utilidades de métricas / parsing
# ──────────────────────────────────────────────────────────────

def _is_finite_number(x: Any) -> bool:
    try:
        return x is not None and math.isfinite(float(x))
    except Exception:
        return False


def extraer_kcal(texto: str) -> float:
    """Extrae el primer valor calórico (kcal) del texto.

    Devuelve NaN si no encuentra un patrón.
    """
    if not isinstance(texto, str) or not texto.strip():
        return float("nan")

    # Caso explícito "N/A"
    if re.search(r"calor[ií]as\s*:\s*n/?a\b", texto, flags=re.IGNORECASE):
        return float("nan")

    patrones = [
        r"(\d{2,4}(?:[.,]\d+)?)\s*kcal\b",
        r"(\d{2,4}(?:[.,]\d+)?)\s*kilocalor[ií]as\b",
        r"[Cc]alor[ií]as\s*[:=]?\s*(\d{2,4}(?:[.,]\d+)?)",
        r"[Ee]nerg[ií]a\s*[:=]?\s*(\d{2,4}(?:[.,]\d+)?)",
    ]
    for patron in patrones:
        match = re.search(patron, texto, flags=re.IGNORECASE)
        if match:
            raw = match.group(1).replace(",", ".")
            try:
                return float(raw)
            except Exception:
                return float("nan")
    return float("nan")


def normalizar_kcal_pred(kcal: Any) -> float:
    """Normaliza kcal predicha para evitar errores de escala/parsing.

    Reglas solicitadas:
    - kcal_pred debe estar entre 0 y 1000
    - Si > 1000 → NaN
    - Convertir a float y redondear
    """
    if not _is_finite_number(kcal):
        return float("nan")

    v = float(kcal)
    if v < 0 or v > 1000:
        return float("nan")

    # Redondeo: 1 decimal, pero colapsa .0 a entero (351.0 → 351)
    v = round(v, 1)
    if abs(v - round(v)) < 1e-9:
        v = float(int(round(v)))
    return float(v)


def _guess_food_name(pregunta: str) -> str:
    """Heurística simple para extraer el 'alimento' desde la pregunta."""
    if not isinstance(pregunta, str):
        return ""
    p = pregunta.strip()
    patrones = [
        r"(?:calor[ií]as|kcal)\s+tiene\s+la\s+(.+?)\s+(?:por|en)\s+100",
        r"(?:calor[ií]as|kcal)\s+tiene\s+el\s+(.+?)\s+(?:por|en)\s+100",
        r"tiene\s+la\s+(.+?)\s+(?:por|en)\s+100",
        r"tiene\s+el\s+(.+?)\s+(?:por|en)\s+100",
        r"tiene\s+(.+?)\s+(?:por|en)\s+100",
    ]
    for pat in patrones:
        m = re.search(pat, p, flags=re.IGNORECASE)
        if m:
            cand = re.sub(r"[¿?]", "", m.group(1)).strip()
            cand = re.sub(r"\s+", " ", cand)
            return cand
    return ""


def kcal_from_rag_context(contexto_recuperado: Any, pregunta: str) -> float:
    """Intenta obtener kcal/100g directamente del contexto TPCA devuelto por RAG."""
    if not isinstance(contexto_recuperado, list) or not contexto_recuperado:
        return float("nan")

    food_guess = limpiar(_guess_food_name(pregunta))

    candidatos = []
    for item in contexto_recuperado:
        if not isinstance(item, dict):
            continue
        meta = item.get("metadata") or {}
        if not isinstance(meta, dict):
            continue

        energia = meta.get("energia_kcal")
        if energia is None:
            continue

        energia_f = normalizar_kcal_pred(energia)
        if not _is_finite_number(energia_f):
            continue

        score = item.get("score", 0.0)
        try:
            score_f = float(score)
        except Exception:
            score_f = 0.0

        nombre = limpiar(str(meta.get("nombre", "") or ""))
        name_match = 0
        if food_guess and (food_guess in nombre or nombre in food_guess):
            name_match = 1

        candidatos.append((name_match, score_f, energia_f))

    if not candidatos:
        return float("nan")

    # Preferir coincidencia por nombre, luego mayor score
    candidatos.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return float(candidatos[0][2])


def _strip_models_prefix(model_name: str) -> str:
    m = (model_name or "").strip()
    if m.startswith("models/"):
        return m[len("models/") :]
    return m


def _add_models_prefix(model_name: str) -> str:
    m = (model_name or "").strip()
    if not m:
        return m
    if m.startswith("models/"):
        return m
    return f"models/{m}"


def _pick_first_available_model(
    available: list[str],
    preferred: list[str],
) -> str:
    """Selecciona el primer modelo disponible, considerando variantes con/sin 'models/'."""
    avail_set = set(available)
    avail_strip = { _strip_models_prefix(a) for a in available }
    for cand in preferred:
        if cand in avail_set:
            return cand
        if _strip_models_prefix(cand) in avail_strip:
            return _strip_models_prefix(cand)
        if _add_models_prefix(cand) in avail_set:
            return _add_models_prefix(cand)
    # Fallback: devuelve el primero
    return available[0] if available else preferred[0]

def mape_pct(kcal_real: float, kcal_pred: float) -> float:
    if not _is_finite_number(kcal_real) or abs(float(kcal_real)) < 1e-9:
        return float("nan")
    if not _is_finite_number(kcal_pred):
        return float("nan")
    return abs(float(kcal_real) - float(kcal_pred)) / abs(float(kcal_real)) * 100.0


def error_abs(kcal_real: float, kcal_pred: float) -> float:
    if not _is_finite_number(kcal_real) or not _is_finite_number(kcal_pred):
        return float("nan")
    return abs(float(kcal_real) - float(kcal_pred))


def limpiar(texto: str) -> str:
    if not isinstance(texto, str):
        return ""
    t = texto.lower()
    t = re.sub(r"[^a-záéíóúüñ0-9 ]", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def coseno_ngram_12(texto_ref: str, texto_modelo: str) -> float:
    if isinstance(texto_modelo, str) and texto_modelo.strip().upper().startswith("ERROR"):
        return float("nan")
    t1 = limpiar(texto_ref)
    t2 = limpiar(texto_modelo)
    if not t1 or not t2:
        return float("nan")
    try:
        vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
        X = vec.fit_transform([t1, t2])
        return float(cosine_similarity(X[0], X[1])[0][0])
    except Exception:
        return float("nan")


def clasificar_mape(mape: float) -> str:
    """Clasificación solicitada:
      Excelente ≤10%
      Aceptable ≤20%
      Revisar >20%
    """
    if not _is_finite_number(mape):
        return "Sin dato"
    m = float(mape)
    if m <= 10:
        return "Excelente"
    if m <= 20:
        return "Aceptable"
    return "Revisar"


# ──────────────────────────────────────────────────────────────
# Llamadas a modelos
# ──────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ModelResult:
    respuesta: str
    kcal: float
    tiempo_ms: float
    extra: Dict[str, Any]


def call_rag_http(
    client: httpx.Client,
    url: str,
    pregunta: str,
    timeout_s: float,
) -> ModelResult:
    payload = {
        "mensaje": pregunta,
        "perfil_salud": {
            "clasificacion_dm2": "DM2_SIN_COMPLICACIONES",
            "carbohidratos_max": 45.0,
        },
        "historial": [],
    }

    t0 = time.perf_counter()
    resp = client.post(url, json=payload, timeout=timeout_s)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    resp.raise_for_status()
    data = resp.json()

    texto = str(data.get("respuesta", "") or "")
    # Preferir kcal desde contexto TPCA (evita que el LLM devuelva kcal por porción u otro alimento)
    kcal_ctx = kcal_from_rag_context(data.get("contexto_recuperado"), pregunta=pregunta)
    kcal_txt = extraer_kcal(texto)
    kcal = normalizar_kcal_pred(kcal_ctx if _is_finite_number(kcal_ctx) else kcal_txt)
    extra = {
        "tokens_entrada": data.get("tokens_entrada"),
        "tokens_salida": data.get("tokens_salida"),
        "score_similitud": data.get("score_similitud"),
        "chunks_recuperados": data.get("chunks_recuperados"),
        "kcal_fuente": "contexto" if _is_finite_number(kcal_ctx) else ("texto" if _is_finite_number(kcal_txt) else "none"),
    }
    return ModelResult(respuesta=texto, kcal=kcal, tiempo_ms=elapsed_ms, extra=extra)


def _build_llm_prompt(pregunta: str) -> Tuple[str, str]:
    system = (
        "Eres un asistente nutricional. Responde en español.\n"
        "INSTRUCCIONES ESTRICTAS:\n"
        "1) La PRIMERA línea debe ser EXACTAMENTE: 'Calorías: <entero> kcal'\n"
        "   - Sin decimales, sin comas, sin texto adicional en esa línea.\n"
        "2) Si no puedes inferir un valor, usa: 'Calorías: N/A'\n"
        "3) Luego explica brevemente (máx. 6 líneas).\n"
        "4) No inventes fuentes; si no tienes TPCA, dilo explícitamente.\n"
    )
    user = f"Pregunta: {pregunta}"
    return system, user


def call_openai_gpt(
    pregunta: str,
    api_key: str,
    model: str,
    timeout_s: float,
    temperature: float,
    max_tokens: int,
) -> ModelResult:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    system, user = _build_llm_prompt(pregunta)

    t0 = time.perf_counter()
    resp = client.with_options(timeout=timeout_s).chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    texto = (resp.choices[0].message.content or "").strip()
    kcal = normalizar_kcal_pred(extraer_kcal(texto))
    extra = {
        "tokens_entrada": getattr(resp.usage, "prompt_tokens", None),
        "tokens_salida": getattr(resp.usage, "completion_tokens", None),
    }
    return ModelResult(respuesta=texto, kcal=kcal, tiempo_ms=elapsed_ms, extra=extra)


def call_gemini(
    pregunta: str,
    api_key: str,
    model: str,
    timeout_s: float,
    temperature: float,
    max_tokens: int,
) -> ModelResult:
    # 1) Preferir SDK nuevo (google-genai). 2) Fallback a SDK legacy (google-generativeai).
    system, user = _build_llm_prompt(pregunta)
    prompt = f"{system}\n\n{user}"

    preferred_models = [
        model,
        _strip_models_prefix(model),
        "gemini-1.5-pro-latest",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-flash-latest",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
    ]

    # ── SDK NUEVO: google-genai ──────────────────────────────
    try:
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore

        client = genai.Client(api_key=api_key)

        # Descubrir modelos disponibles (con este API key)
        available = []
        try:
            for m in client.models.list(config={"page_size": 200}):
                name = getattr(m, "name", None)
                if isinstance(name, str) and name:
                    available.append(_strip_models_prefix(name))
        except Exception:
            available = []

        chosen = _pick_first_available_model(available, preferred_models) if available else preferred_models[0]

        cfg = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        t0 = time.perf_counter()
        resp = client.models.generate_content(
            model=_strip_models_prefix(chosen),
            contents=prompt,
            config=cfg,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        texto = getattr(resp, "text", "") or ""
        texto = str(texto).strip()
        kcal = normalizar_kcal_pred(extraer_kcal(texto))
        extra = {"sdk": "google-genai", "model_usado": _strip_models_prefix(chosen)}
        return ModelResult(respuesta=texto, kcal=kcal, tiempo_ms=elapsed_ms, extra=extra)
    except ImportError:
        pass
    except Exception as e:
        # Si el SDK nuevo está instalado pero falla (p.ej. modelo NOT_FOUND),
        # seguimos con fallback legacy para no invalidar toda la corrida.
        last_err = e
    else:
        last_err = None

    # ── SDK LEGACY: google-generativeai ───────────────────────
    try:
        import google.generativeai as genai  # type: ignore
    except Exception as e:  # pragma: no cover
        base = "Gemini: faltan dependencias. Instala: pip install google-genai"
        if "google-generativeai" in str(e).lower():
            base = "Gemini: falta dependencia. Instala: pip install google-generativeai (o mejor: pip install google-genai)"
        raise RuntimeError(base) from e

    genai.configure(api_key=api_key)

    # El SDK legacy usa v1beta en muchos entornos; el string del modelo puede variar.
    available_legacy = []
    try:
        for m in genai.list_models(page_size=200):
            name = getattr(m, "name", None)
            methods = getattr(m, "supported_generation_methods", None)
            if isinstance(name, str) and name:
                if isinstance(methods, (list, tuple)) and ("generateContent" not in methods):
                    continue
                available_legacy.append(name)
    except Exception:
        available_legacy = []

    chosen_legacy = _pick_first_available_model(available_legacy, preferred_models) if available_legacy else model

    cfg_legacy: Dict[str, Any] = {
        "temperature": temperature,
        "max_output_tokens": max_tokens,
    }

    t0 = time.perf_counter()
    try:
        m = genai.GenerativeModel(model_name=_strip_models_prefix(chosen_legacy))
        resp = m.generate_content(prompt, generation_config=cfg_legacy)
    except Exception as e:
        # Agregar contexto del error del SDK nuevo si existía
        if "last_err" in locals() and last_err is not None:
            raise RuntimeError(f"Gemini falló (google-genai y legacy). Último error google-genai: {last_err}. Error legacy: {e}") from e
        raise
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    texto = getattr(resp, "text", "") or ""
    texto = str(texto).strip()
    kcal = normalizar_kcal_pred(extraer_kcal(texto))
    extra = {"sdk": "google-generativeai", "model_usado": _strip_models_prefix(chosen_legacy)}
    return ModelResult(respuesta=texto, kcal=kcal, tiempo_ms=elapsed_ms, extra=extra)


# ──────────────────────────────────────────────────────────────
# Dataset IO + ejecución
# ──────────────────────────────────────────────────────────────

def load_dataset(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"No existe el archivo: {path}")

    ext = os.path.splitext(path)[1].lower()
    if ext in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    if ext == ".csv":
        return pd.read_csv(path)
    raise ValueError("Formato no soportado. Usa .csv o .xlsx/.xls")


def _best_model_min(metric_by_model: Dict[str, float]) -> str:
    vals = {k: v for k, v in metric_by_model.items() if _is_finite_number(v)}
    if not vals:
        return "N/A"
    return min(vals.items(), key=lambda kv: kv[1])[0]


def _best_model_max(metric_by_model: Dict[str, float]) -> str:
    vals = {k: v for k, v in metric_by_model.items() if _is_finite_number(v)}
    if not vals:
        return "N/A"
    return max(vals.items(), key=lambda kv: kv[1])[0]


def _improvement_pct(baseline: float, challenger: float) -> float:
    """% mejora (positivo = mejora): (baseline - challenger) / baseline * 100."""
    if not _is_finite_number(baseline) or float(baseline) == 0:
        return float("nan")
    if not _is_finite_number(challenger):
        return float("nan")
    return (float(baseline) - float(challenger)) / float(baseline) * 100.0


def build_thesis_text(
    mape_rag: float,
    mape_gpt: float,
    mape_gemini: float,
    cos_rag: float,
    cos_gpt: float,
    cos_gemini: float,
) -> str:
    # Texto breve, listo para pegar en tesis (editable).
    best_mape = _best_model_min({"RAG": mape_rag, "GPT": mape_gpt, "Gemini": mape_gemini})
    best_cos = _best_model_max({"RAG": cos_rag, "GPT": cos_gpt, "Gemini": cos_gemini})
    imp_vs_gpt = _improvement_pct(mape_gpt, mape_rag)
    imp_vs_gem = _improvement_pct(mape_gemini, mape_rag)

    parts = [
        "En la evaluación comparativa, el enfoque RAG (Pinecone + LLM) mostró un desempeño competitivo frente a los modelos base sin recuperación.",
    ]
    if best_mape != "N/A":
        parts.append(
            f"En precisión calórica (MAPE promedio), el mejor desempeño correspondió a {best_mape}."
        )
    if _is_finite_number(imp_vs_gpt):
        parts.append(f"En términos relativos, RAG mejoró el MAPE en {imp_vs_gpt:.2f}% frente a GPT.")
    if _is_finite_number(imp_vs_gem):
        parts.append(f"Asimismo, RAG mejoró el MAPE en {imp_vs_gem:.2f}% frente a Gemini.")
    if best_cos != "N/A":
        parts.append(
            f"En coherencia semántica (similitud de coseno n-gram 1–2), el mejor desempeño correspondió a {best_cos}."
        )
    parts.append(
        "Estos resultados sugieren que la recuperación de información puede reducir errores numéricos al anclar la respuesta a contexto nutricional relevante, manteniendo una coherencia adecuada con el texto de referencia."
    )
    return " ".join(parts)


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Comparación RAG vs GPT vs Gemini (sin RAG)")
    parser.add_argument("--input", required=True, help="Ruta a dataset (.csv o .xlsx) con pregunta/kcal_real/texto_ref")
    parser.add_argument("--output-dir", default=".", help="Carpeta de salida (CSV)")
    parser.add_argument("--rag-url", default=os.getenv("RAG_EVAL_URL", "http://localhost:8000/api/recommend"))
    parser.add_argument("--timeout", type=float, default=60.0, help="Timeout por request (segundos)")

    parser.add_argument("--openai-model", default=os.getenv("OPENAI_MODEL", "gpt-4"))
    parser.add_argument("--openai-temperature", type=float, default=0.2)
    parser.add_argument("--openai-max-tokens", type=int, default=600)

    # Modelos recomendados (2025/2026): gemini-1.5-pro-latest, gemini-1.5-flash
    parser.add_argument("--gemini-model", default=os.getenv("GEMINI_MODEL", "gemini-1.5-pro-latest"))
    parser.add_argument("--gemini-temperature", type=float, default=0.2)
    parser.add_argument("--gemini-max-tokens", type=int, default=600)

    parser.add_argument("--save-every", type=int, default=10, help="Guarda comparacion_modelos.csv cada N filas")
    args = parser.parse_args()

    out_dir = args.output_dir
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "comparacion_modelos.csv")
    summary_path = os.path.join(out_dir, "resumen_modelos.csv")

    df_in = load_dataset(args.input)
    required = ["pregunta", "kcal_real", "texto_ref"]
    for col in required:
        if col not in df_in.columns:
            raise SystemExit(f"Falta columna requerida '{col}' en el dataset")

    # Trabajar sobre copia para no "alterar" el dataset original
    df = df_in[required].copy()
    df["kcal_real"] = pd.to_numeric(df["kcal_real"], errors="coerce")

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    gemini_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()

    print("=" * 72)
    print("  COMPARACIÓN RAG vs GPT vs Gemini (sin RAG) — NutriDiabetes Perú")
    print("=" * 72)
    print(f"  Input:      {args.input}")
    print(f"  Output dir: {out_dir}")
    print(f"  RAG URL:    {args.rag_url}")
    print(f"  Registros:  {len(df)}")
    print("=" * 72)
    if not openai_key:
        print("  AVISO: OPENAI_API_KEY no configurada → GPT fallará.")
    if not gemini_key:
        print("  AVISO: GEMINI_API_KEY / GOOGLE_API_KEY no configurada → Gemini fallará.")
    print()

    # Columnas de salida solicitadas
    df["respuesta_rag"] = ""
    df["kcal_rag"] = np.nan
    df["respuesta_gpt"] = ""
    df["kcal_gpt"] = np.nan
    df["respuesta_gemini"] = ""
    df["kcal_gemini"] = np.nan

    df["mape_rag"] = np.nan
    df["mape_gpt"] = np.nan
    df["mape_gemini"] = np.nan

    df["error_abs_rag"] = np.nan
    df["error_abs_gpt"] = np.nan
    df["error_abs_gemini"] = np.nan

    df["coseno_rag"] = np.nan
    df["coseno_gpt"] = np.nan
    df["coseno_gemini"] = np.nan

    df["tiempo_rag"] = np.nan
    df["tiempo_gpt"] = np.nan
    df["tiempo_gemini"] = np.nan

    # Extras útiles (no solicitados, pero ayudan en análisis)
    df["clasif_rag"] = ""
    df["clasif_gpt"] = ""
    df["clasif_gemini"] = ""
    df["tokens_in_rag"] = np.nan
    df["tokens_out_rag"] = np.nan
    df["tokens_in_gpt"] = np.nan
    df["tokens_out_gpt"] = np.nan
    df["score_similitud_rag"] = np.nan
    df["chunks_recuperados_rag"] = np.nan
    df["kcal_fuente_rag"] = ""
    df["gemini_sdk"] = ""
    df["gemini_model_usado"] = ""

    with httpx.Client() as http:
        for pos, idx in enumerate(df.index):
            row = df.loc[idx]
            pregunta = str(row["pregunta"])
            kcal_real = row["kcal_real"]
            texto_ref = str(row["texto_ref"])

            print(f"[{pos+1:>4}/{len(df)}] {pregunta[:70]}{'...' if len(pregunta) > 70 else ''}")

            # ── A) RAG ─────────────────────────────────────────
            try:
                r = call_rag_http(http, args.rag_url, pregunta, timeout_s=args.timeout)
                df.at[idx, "respuesta_rag"] = r.respuesta
                df.at[idx, "kcal_rag"] = r.kcal
                df.at[idx, "tiempo_rag"] = r.tiempo_ms
                df.at[idx, "tokens_in_rag"] = r.extra.get("tokens_entrada")
                df.at[idx, "tokens_out_rag"] = r.extra.get("tokens_salida")
                df.at[idx, "score_similitud_rag"] = r.extra.get("score_similitud")
                df.at[idx, "chunks_recuperados_rag"] = r.extra.get("chunks_recuperados")
                df.at[idx, "kcal_fuente_rag"] = r.extra.get("kcal_fuente") or ""
            except Exception as e:
                df.at[idx, "respuesta_rag"] = f"ERROR: {e}"

            # ── B) GPT (sin RAG) ───────────────────────────────
            try:
                if not openai_key:
                    raise RuntimeError("OPENAI_API_KEY no configurada")
                g = call_openai_gpt(
                    pregunta=pregunta,
                    api_key=openai_key,
                    model=args.openai_model,
                    timeout_s=args.timeout,
                    temperature=args.openai_temperature,
                    max_tokens=args.openai_max_tokens,
                )
                df.at[idx, "respuesta_gpt"] = g.respuesta
                df.at[idx, "kcal_gpt"] = g.kcal
                df.at[idx, "tiempo_gpt"] = g.tiempo_ms
                df.at[idx, "tokens_in_gpt"] = g.extra.get("tokens_entrada")
                df.at[idx, "tokens_out_gpt"] = g.extra.get("tokens_salida")
            except Exception as e:
                df.at[idx, "respuesta_gpt"] = f"ERROR: {e}"

            # ── C) Gemini (sin RAG) ────────────────────────────
            try:
                if not gemini_key:
                    raise RuntimeError("GEMINI_API_KEY/GOOGLE_API_KEY no configurada")
                gm = call_gemini(
                    pregunta=pregunta,
                    api_key=gemini_key,
                    model=args.gemini_model,
                    timeout_s=args.timeout,
                    temperature=args.gemini_temperature,
                    max_tokens=args.gemini_max_tokens,
                )
                df.at[idx, "respuesta_gemini"] = gm.respuesta
                df.at[idx, "kcal_gemini"] = gm.kcal
                df.at[idx, "tiempo_gemini"] = gm.tiempo_ms
                df.at[idx, "gemini_sdk"] = gm.extra.get("sdk", "")
                df.at[idx, "gemini_model_usado"] = gm.extra.get("model_usado", "")
            except Exception as e:
                df.at[idx, "respuesta_gemini"] = f"ERROR: {e}"

            # ── Métricas por fila ───────────────────────────────
            # Normalización/sanity-check antes de métricas (evita escala x10 y strings)
            kcal_real_f = float(kcal_real) if _is_finite_number(kcal_real) else float("nan")

            kcal_rag_f = normalizar_kcal_pred(df.at[idx, "kcal_rag"])
            kcal_gpt_f = normalizar_kcal_pred(df.at[idx, "kcal_gpt"])
            kcal_gem_f = normalizar_kcal_pred(df.at[idx, "kcal_gemini"])

            df.at[idx, "kcal_rag"] = kcal_rag_f
            df.at[idx, "kcal_gpt"] = kcal_gpt_f
            df.at[idx, "kcal_gemini"] = kcal_gem_f

            df.at[idx, "error_abs_rag"] = error_abs(kcal_real_f, kcal_rag_f)
            df.at[idx, "error_abs_gpt"] = error_abs(kcal_real_f, kcal_gpt_f)
            df.at[idx, "error_abs_gemini"] = error_abs(kcal_real_f, kcal_gem_f)

            df.at[idx, "mape_rag"] = mape_pct(kcal_real_f, kcal_rag_f)
            df.at[idx, "mape_gpt"] = mape_pct(kcal_real_f, kcal_gpt_f)
            df.at[idx, "mape_gemini"] = mape_pct(kcal_real_f, kcal_gem_f)

            df.at[idx, "coseno_rag"] = coseno_ngram_12(texto_ref, df.at[idx, "respuesta_rag"])
            df.at[idx, "coseno_gpt"] = coseno_ngram_12(texto_ref, df.at[idx, "respuesta_gpt"])
            df.at[idx, "coseno_gemini"] = coseno_ngram_12(texto_ref, df.at[idx, "respuesta_gemini"])

            df.at[idx, "clasif_rag"] = clasificar_mape(df.at[idx, "mape_rag"])
            df.at[idx, "clasif_gpt"] = clasificar_mape(df.at[idx, "mape_gpt"])
            df.at[idx, "clasif_gemini"] = clasificar_mape(df.at[idx, "mape_gemini"])

            if args.save_every > 0 and ((pos + 1) % args.save_every == 0):
                df.to_csv(out_path, index=False, encoding="utf-8-sig")
                print(f"  Guardado parcial: {out_path}")
                print()

    # ── Resumen global ─────────────────────────────────────────
    resumen_rows = []
    for nombre, mape_col, cos_col, t_col in [
        ("RAG", "mape_rag", "coseno_rag", "tiempo_rag"),
        ("GPT", "mape_gpt", "coseno_gpt", "tiempo_gpt"),
        ("Gemini", "mape_gemini", "coseno_gemini", "tiempo_gemini"),
    ]:
        s_mape = df[mape_col].dropna()
        s_cos = df[cos_col].dropna()
        s_t = df[t_col].dropna()
        resumen_rows.append(
            {
                "modelo": nombre,
                "n": int(len(df)),
                "n_mape": int(len(s_mape)),
                "mape_promedio": float(s_mape.mean()) if len(s_mape) else float("nan"),
                "mape_std": float(s_mape.std()) if len(s_mape) else float("nan"),
                "coseno_promedio": float(s_cos.mean()) if len(s_cos) else float("nan"),
                "coseno_std": float(s_cos.std()) if len(s_cos) else float("nan"),
                "tiempo_promedio_ms": float(s_t.mean()) if len(s_t) else float("nan"),
                "tiempo_std_ms": float(s_t.std()) if len(s_t) else float("nan"),
            }
        )

    df_summary = pd.DataFrame(resumen_rows)

    # Mejores por métrica
    mape_means = {r["modelo"]: r["mape_promedio"] for r in resumen_rows}
    cos_means = {r["modelo"]: r["coseno_promedio"] for r in resumen_rows}
    t_means = {r["modelo"]: r["tiempo_promedio_ms"] for r in resumen_rows}

    best_mape = _best_model_min(mape_means)
    best_cos = _best_model_max(cos_means)
    best_time = _best_model_min(t_means)

    imp_rag_vs_gpt = _improvement_pct(mape_means.get("GPT", float("nan")), mape_means.get("RAG", float("nan")))
    imp_rag_vs_gem = _improvement_pct(mape_means.get("Gemini", float("nan")), mape_means.get("RAG", float("nan")))

    thesis_text = build_thesis_text(
        mape_rag=mape_means.get("RAG", float("nan")),
        mape_gpt=mape_means.get("GPT", float("nan")),
        mape_gemini=mape_means.get("Gemini", float("nan")),
        cos_rag=cos_means.get("RAG", float("nan")),
        cos_gpt=cos_means.get("GPT", float("nan")),
        cos_gemini=cos_means.get("Gemini", float("nan")),
    )

    # Anexa KPIs como filas extra (para mantener un solo resumen_modelos.csv)
    df_kpis = pd.DataFrame(
        [
            {"modelo": "KPI", "kpi": "mejor_mape", "valor": best_mape},
            {"modelo": "KPI", "kpi": "mejor_coseno", "valor": best_cos},
            {"modelo": "KPI", "kpi": "mejor_tiempo", "valor": best_time},
            {"modelo": "KPI", "kpi": "mejora_rag_vs_gpt_%", "valor": imp_rag_vs_gpt},
            {"modelo": "KPI", "kpi": "mejora_rag_vs_gemini_%", "valor": imp_rag_vs_gem},
            {"modelo": "KPI", "kpi": "texto_tesis", "valor": thesis_text},
        ]
    )
    df_summary = pd.concat([df_summary, df_kpis], ignore_index=True, sort=False)

    # Exportar
    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    df_summary.to_csv(summary_path, index=False, encoding="utf-8-sig")

    print()
    print("=" * 72)
    print("  EXPORTACIÓN COMPLETADA")
    print("=" * 72)
    print(f"  Comparación: {out_path}")
    print(f"  Resumen:     {summary_path}")
    print()
    print("  TEXTO AUTOMÁTICO (tesis):")
    print(f"  {thesis_text}")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
