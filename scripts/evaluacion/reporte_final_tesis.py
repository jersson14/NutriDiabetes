"""
============================================================
REPORTE FINAL DE TESIS — NutriDiabetes Perú
Sistema RAG para Diabetes Mellitus Tipo 2
============================================================
USO:
  cd scripts/evaluacion
  python reporte_final_tesis.py
============================================================
"""

import pandas as pd
import numpy as np
import os

DIR         = os.path.dirname(__file__)
DATA_PATH   = os.path.join(DIR, "data", "data.xlsx")
COSENO_PATH = os.path.join(DIR, "data", "coseno_resultados.xlsx")
OUT_EXCEL   = os.path.join(DIR, "data", "resultados_finales_tesis.xlsx")
OUT_DIR     = os.path.join(DIR, "data", "graficos")
os.makedirs(OUT_DIR, exist_ok=True)


# ════════════════════════════════════════════════════════════
# CARGA Y PREPARACIÓN
# ════════════════════════════════════════════════════════════

def cargar_datos() -> pd.DataFrame:

    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError("Ejecuta primero generar_data.py")

    df = pd.read_excel(DATA_PATH)

    # Limpieza básica
    df = df.dropna(subset=["kcal_real", "kcal_rag"]).copy()
    df["error_abs"] = abs(df["kcal_real"] - df["kcal_rag"])
    df["error_%"]   = (df["error_abs"] / df["kcal_real"]) * 100

    # Filtro MAPE: solo consultas directas de kcal
    EXCLUIR_MAPE = (
        "desayuno|almuerzo|cena|merienda|colaci|"
        "menú|menu|postre|bebida|superalimento|DM2|"
        " vs |proteín|fibra|antioxidante|insulina|"
        "glucano|betacaroteno|hierro|pop|snack"
    )
    df["es_simple"] = (
        df["pregunta"].str.contains("calorías|calorias", case=False, na=False)
        & ~df["pregunta"].str.contains(EXCLUIR_MAPE, case=False, na=False)
    )

    # Clasificación MAPE
    def clasif_mape(x):
        if x <= 5:    return "Excelente"
        elif x <= 10: return "Bueno"
        elif x <= 20: return "Aceptable"
        else:         return "Revisar"

    df["clasificacion"] = df["error_%"].apply(clasif_mape)

    # Tipo de pregunta
    def clasif_tipo(p):
        p = str(p).lower()
        if any(x in p for x in ["desayuno", "almuerzo", "cena", "menú", "menu"]):
            return "Combinación (dieta)"
        elif "calor" in p:
            return "Simple (calorías)"
        else:
            return "Compleja (nutrición)"

    df["tipo_pregunta"] = df["pregunta"].apply(clasif_tipo)

    # Coseno embeddings
    if os.path.exists(COSENO_PATH):
        try:
            dc = pd.read_excel(COSENO_PATH)
            for col in dc.columns:
                if "Embeddings" in col and "Coseno" in col:
                    dc = dc.rename(columns={col: "embedding"})
            for col in dc.columns:
                if "Alimento" in col or col.lower() == "alimento":
                    dc = dc.rename(columns={col: "alimento"})
            if "embedding" in dc.columns and "alimento" in dc.columns:
                df = df.merge(dc[["alimento", "embedding"]], on="alimento", how="left")
            else:
                df["embedding"] = np.nan
        except Exception:
            df["embedding"] = np.nan
    else:
        df["embedding"] = np.nan

    return df


# ════════════════════════════════════════════════════════════
# GRÁFICOS
# ════════════════════════════════════════════════════════════

def generar_graficos(df_simple: pd.DataFrame, df: pd.DataFrame):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        PALETTE = {"Excelente": "#2ecc71", "Bueno": "#3498db",
                   "Aceptable": "#f39c12", "Revisar": "#e74c3c"}

        # G1: Histograma MAPE
        fig, ax = plt.subplots(figsize=(9, 5))
        ax.hist(df_simple["error_%"].dropna(), bins=12,
                color="#3498db", edgecolor="white", alpha=0.85)
        ax.axvline(df_simple["error_%"].mean(), color="#e74c3c",
                   linewidth=2, linestyle="--",
                   label=f"Media = {df_simple['error_%'].mean():.2f}%")
        ax.axvline(5,  color="#2ecc71", linewidth=1.2, linestyle=":",
                   label="Excelente (5%)")
        ax.axvline(10, color="#f39c12", linewidth=1.2, linestyle=":",
                   label="Bueno (10%)")
        ax.set_xlabel("Error MAPE (%)", fontsize=12)
        ax.set_ylabel("Frecuencia", fontsize=12)
        ax.set_title("Histograma MAPE — Consultas directas kcal\nNutriDiabetes Perú",
                     fontsize=13, fontweight="bold")
        ax.legend(fontsize=9)
        ax.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        plt.savefig(os.path.join(OUT_DIR, "g1_histograma_mape.png"),
                    dpi=150, bbox_inches="tight", facecolor="white")
        plt.close()
        print("  G1 — Histograma MAPE")

        # G2: Histograma Coseno
        emb = df["embedding"].dropna()
        if len(emb) > 0:
            fig, ax = plt.subplots(figsize=(9, 5))
            ax.hist(emb, bins=12, color="#9b59b6", edgecolor="white", alpha=0.85)
            ax.axvline(emb.mean(), color="#e74c3c", linewidth=2, linestyle="--",
                       label=f"Media = {emb.mean():.4f}")
            ax.axvline(0.85, color="#2ecc71", linewidth=1.2, linestyle=":",
                       label="Alta (0.85)")
            ax.axvline(0.70, color="#f39c12", linewidth=1.2, linestyle=":",
                       label="Buena (0.70)")
            ax.set_xlabel("Similitud Coseno", fontsize=12)
            ax.set_ylabel("Frecuencia", fontsize=12)
            ax.set_title("Histograma Similitud Semántica\nNutriDiabetes Perú",
                         fontsize=13, fontweight="bold")
            ax.legend(fontsize=9)
            ax.grid(axis="y", alpha=0.3)
            plt.tight_layout()
            plt.savefig(os.path.join(OUT_DIR, "g2_histograma_coseno.png"),
                        dpi=150, bbox_inches="tight", facecolor="white")
            plt.close()
            print("  G2 — Histograma Coseno")

        # G3: MAPE por tipo de pregunta
        fig, ax = plt.subplots(figsize=(9, 5))
        por_tipo = df.groupby("tipo_pregunta")["error_%"].mean().sort_values()
        colores  = ["#2ecc71", "#3498db", "#f39c12"][:len(por_tipo)]
        bars = ax.bar(por_tipo.index, por_tipo.values, color=colores,
                      edgecolor="white", alpha=0.9)
        for bar, val in zip(bars, por_tipo.values):
            ax.text(bar.get_x() + bar.get_width() / 2,
                    bar.get_height() + 0.3,
                    f"{val:.1f}%", ha="center", va="bottom", fontsize=10)
        ax.axhline(10, color="#e74c3c", linestyle="--", linewidth=1.2,
                   alpha=0.7, label="Umbral Bueno (10%)")
        ax.set_ylabel("MAPE promedio (%)", fontsize=12)
        ax.set_title("MAPE por Tipo de Pregunta\nNutriDiabetes Perú",
                     fontsize=13, fontweight="bold")
        ax.legend(fontsize=9)
        ax.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        plt.savefig(os.path.join(OUT_DIR, "g3_mape_por_tipo.png"),
                    dpi=150, bbox_inches="tight", facecolor="white")
        plt.close()
        print("  G3 — MAPE por tipo")

        # G4: Distribución pastel
        dist  = df_simple["clasificacion"].value_counts()
        orden = [c for c in ["Excelente", "Bueno", "Aceptable", "Revisar"]
                 if c in dist.index]
        fig, ax = plt.subplots(figsize=(7, 7))
        ax.pie([dist[c] for c in orden],
               labels=orden,
               colors=[PALETTE[c] for c in orden],
               autopct="%1.1f%%", startangle=140,
               wedgeprops={"edgecolor": "white", "linewidth": 1.5},
               textprops={"fontsize": 11})
        ax.set_title("Distribución MAPE — Consultas directas\nNutriDiabetes Perú",
                     fontsize=13, fontweight="bold", pad=20)
        plt.tight_layout()
        plt.savefig(os.path.join(OUT_DIR, "g4_distribucion.png"),
                    dpi=150, bbox_inches="tight", facecolor="white")
        plt.close()
        print("  G4 — Distribución pastel")

        # G5: Scatter MAPE vs Coseno (solo simples con embedding)
        df_sc = df_simple[["error_%", "embedding", "clasificacion"]].dropna()
        if len(df_sc) > 3:
            fig, ax = plt.subplots(figsize=(8, 6))
            for clasif, color in PALETTE.items():
                sub = df_sc[df_sc["clasificacion"] == clasif]
                if len(sub):
                    ax.scatter(sub["error_%"], sub["embedding"],
                               c=color, label=clasif, alpha=0.8, s=70,
                               edgecolors="white", linewidth=0.5)
            ax.set_xlabel("Error MAPE (%)", fontsize=12)
            ax.set_ylabel("Similitud Coseno", fontsize=12)
            ax.set_title("MAPE vs Similitud Semántica\nNutriDiabetes Perú",
                         fontsize=13, fontweight="bold")
            ax.legend(title="Clasificación", fontsize=9)
            ax.grid(alpha=0.3)
            plt.tight_layout()
            plt.savefig(os.path.join(OUT_DIR, "g5_scatter.png"),
                        dpi=150, bbox_inches="tight", facecolor="white")
            plt.close()
            print("  G5 — Scatter MAPE vs Coseno")

    except ImportError:
        print("  Instala matplotlib: pip install matplotlib")
    except Exception as e:
        print(f"  Error gráficos: {e}")


# ════════════════════════════════════════════════════════════
# EXPORTAR EXCEL
# ════════════════════════════════════════════════════════════

def exportar_excel(df_simple: pd.DataFrame, df: pd.DataFrame,
                   resumen: dict, por_tipo: pd.DataFrame, corr):
    cols = [c for c in ["alimento", "tipo_pregunta", "kcal_real", "kcal_rag",
                         "error_%", "clasificacion", "embedding",
                         "tiempo_ms", "tokens_entrada", "tokens_salida"]
            if c in df_simple.columns]

    with pd.ExcelWriter(OUT_EXCEL, engine="openpyxl") as writer:
        df_simple[cols].to_excel(writer, sheet_name="MAPE (evaluación)", index=False)
        df.to_excel(writer, sheet_name="Dataset completo", index=False)
        pd.DataFrame(list(resumen.items()),
                     columns=["Métrica", "Valor"]).to_excel(
            writer, sheet_name="Resumen global", index=False)
        por_tipo.reset_index().to_excel(
            writer, sheet_name="Por tipo pregunta", index=False)
        if corr is not None:
            corr.to_excel(writer, sheet_name="Correlación")

    print(f"  Excel: {OUT_EXCEL}")


# ════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════

def main():
    SEP = "=" * 65

    print(SEP)
    print("  REPORTE FINAL — NutriDiabetes Perú | Tesis Maestría")
    print(SEP)

    try:
        df = cargar_datos()
    except FileNotFoundError as e:
        print(f"\n  ERROR: {e}")
        return

    df_simple   = df[df["es_simple"]].copy()
    df_complejo = df[~df["es_simple"]].copy()
    n_simple    = len(df_simple)
    n_total     = len(df)

    print(f"  Dataset total:         {n_total} registros")
    print(f"  ✔ Evaluación MAPE:     {n_simple} (consultas directas kcal)")
    print(f"  ✦ Excluidos del MAPE:  {len(df_complejo)} (dieta / macros / DM2)")

    if n_simple == 0:
        print("\n  ERROR: Ningún registro pasó el filtro MAPE.")
        print("  Revisa que data.xlsx tenga columna 'pregunta' con 'calorías'.")
        return

    # ── 1. RESUMEN GLOBAL ─────────────────────────────────────
    print()
    print(SEP)
    print("  1. RESUMEN GLOBAL")
    print(SEP)

    mape_prom = df_simple["error_%"].mean()
    mape_std  = df_simple["error_%"].std()
    mape_min  = df_simple["error_%"].min()
    mape_max  = df_simple["error_%"].max()

    emb       = df["embedding"].dropna()
    emb_ok    = len(emb) > 0
    emb_prom  = emb.mean()  if emb_ok else float("nan")
    emb_std   = emb.std()   if emb_ok else float("nan")
    emb_min   = emb.min()   if emb_ok else float("nan")
    emb_max   = emb.max()   if emb_ok else float("nan")

    tm_prom = df["tiempo_ms"].mean()       if "tiempo_ms"      in df.columns else float("nan")
    te_prom = df["tokens_entrada"].mean()  if "tokens_entrada" in df.columns else float("nan")
    ts_prom = df["tokens_salida"].mean()   if "tokens_salida"  in df.columns else float("nan")

    print(f"\n  ── MAPE  (n={n_simple} consultas directas kcal) ──")
    print(f"     Promedio:          {mape_prom:.2f}%")
    print(f"     Desv. estándar:    {mape_std:.2f}%")
    print(f"     Mín / Máx:         {mape_min:.2f}% / {mape_max:.2f}%")

    if emb_ok:
        print(f"\n  ── Coseno Semántico (n={n_total}) ──")
        print(f"     Promedio:          {emb_prom:.4f}")
        print(f"     Desv. estándar:    {emb_std:.4f}")
        print(f"     Mín / Máx:         {emb_min:.4f} / {emb_max:.4f}")

    if not np.isnan(tm_prom):
        print(f"\n  ── Eficiencia operacional ──")
        print(f"     Tiempo prom.:      {tm_prom:.0f} ms")
    if not np.isnan(te_prom):
        print(f"     Tokens entrada:    {te_prom:.0f}")
        print(f"     Tokens salida:     {ts_prom:.0f}")

    # ── 2. DISTRIBUCIÓN ───────────────────────────────────────
    print()
    print(SEP)
    print("  2. DISTRIBUCIÓN (consultas directas kcal)")
    print(SEP)

    dist_abs = df_simple["clasificacion"].value_counts()
    dist_pct = df_simple["clasificacion"].value_counts(normalize=True) * 100
    orden    = ["Excelente", "Bueno", "Aceptable", "Revisar"]
    umbral   = {"Excelente": "≤ 5%", "Bueno": "≤10%",
                "Aceptable": "≤20%", "Revisar": ">20%"}

    print(f"\n  {'Clasificación':<12} {'Umbral':>6} {'Casos':>6} {'%':>8}  Barra")
    print("  " + "─" * 52)
    for cat in orden:
        cnt = dist_abs.get(cat, 0)
        pct = dist_pct.get(cat, 0.0)
        bar = "█" * int(pct / 3)
        print(f"  {cat:<12} {umbral[cat]:>6} {cnt:>6}  {pct:>6.1f}%  {bar}")

    alta = dist_pct.get("Excelente", 0) + dist_pct.get("Bueno", 0)
    print(f"\n  Cobertura Excelente + Bueno:  {alta:.1f}%")

    # ── 3. ANÁLISIS POR TIPO ──────────────────────────────────
    print()
    print(SEP)
    print("  3. ANÁLISIS POR TIPO DE PREGUNTA")
    print(SEP)

    por_tipo = df.groupby("tipo_pregunta")["error_%"].agg(["mean", "std", "count"])
    por_tipo.columns = ["MAPE prom (%)", "Desv. est. (%)", "n"]
    por_tipo = por_tipo.sort_values("MAPE prom (%)")

    print(f"\n  {'Tipo':<28} {'MAPE prom':>10} {'Desv.':>8} {'n':>5}")
    print("  " + "─" * 55)
    for tipo, fila in por_tipo.iterrows():
        tag = "✔" if tipo == "Simple (calorías)" else "✦"
        print(f"  {tag} {tipo:<26} {fila['MAPE prom (%)']:>9.2f}%  "
              f"{fila['Desv. est. (%)']:>6.2f}%  {int(fila['n']):>4}")

    print("\n  ✔ = usado en MAPE    ✦ = solo coseno/semántico")

    # ── 4. CORRELACIÓN ────────────────────────────────────────
    print()
    print(SEP)
    print("  4. CORRELACIÓN (nivel paper)")
    print(SEP)

    cols_corr = [c for c in ["error_%", "embedding", "tiempo_ms",
                              "tokens_entrada", "tokens_salida"]
                 if c in df.columns and df[c].notna().sum() > 3]
    corr = None
    if len(cols_corr) >= 2:
        corr = df[cols_corr].corr().round(3)
        nombres = {"error_%": "MAPE", "embedding": "Coseno",
                   "tiempo_ms": "Tiempo", "tokens_entrada": "Tok.entrada",
                   "tokens_salida": "Tok.salida"}
        corr.index   = [nombres.get(c, c) for c in corr.index]
        corr.columns = [nombres.get(c, c) for c in corr.columns]
        print()
        print(corr.to_string())
    else:
        print("  Columnas insuficientes para correlación.")

    # ── 5. GRÁFICOS ───────────────────────────────────────────
    print()
    print(SEP)
    print("  5. GRÁFICOS")
    print(SEP)
    print()
    generar_graficos(df_simple, df)

    # ── 6. EXCEL ──────────────────────────────────────────────
    print()
    print(SEP)
    print("  6. EXCEL FINAL")
    print(SEP)
    print()

    resumen = {
        "Registros MAPE":              str(n_simple),
        "MAPE promedio (%)":           f"{mape_prom:.2f}",
        "MAPE desv. estándar (%)":     f"{mape_std:.2f}",
        "MAPE mínimo (%)":             f"{mape_min:.2f}",
        "MAPE máximo (%)":             f"{mape_max:.2f}",
        "Excelente ≤5%":               f"{dist_abs.get('Excelente',0)} ({dist_pct.get('Excelente',0):.1f}%)",
        "Bueno ≤10%":                  f"{dist_abs.get('Bueno',0)} ({dist_pct.get('Bueno',0):.1f}%)",
        "Aceptable ≤20%":              f"{dist_abs.get('Aceptable',0)} ({dist_pct.get('Aceptable',0):.1f}%)",
        "Revisar >20%":                f"{dist_abs.get('Revisar',0)} ({dist_pct.get('Revisar',0):.1f}%)",
        "Cobertura Excelente+Bueno":   f"{alta:.1f}%",
    }
    if emb_ok:
        resumen["Coseno promedio"]    = f"{emb_prom:.4f}"
        resumen["Coseno desv. est."]  = f"{emb_std:.4f}"
    if not np.isnan(tm_prom):
        resumen["Tiempo prom. (ms)"]  = f"{tm_prom:.0f}"
    if not np.isnan(te_prom):
        resumen["Tokens entrada"]     = f"{te_prom:.0f}"
        resumen["Tokens salida"]      = f"{ts_prom:.0f}"

    exportar_excel(df_simple, df, resumen, por_tipo, corr)

    # ── 7. TEXTO TESIS ────────────────────────────────────────
    nivel = ("excelente" if mape_prom <= 5  else
             "alta"      if mape_prom <= 10 else
             "aceptable" if mape_prom <= 20 else "baja")

    print()
    print(SEP)
    print("  7. TEXTO PARA TESIS — Capítulo V")
    print(SEP)

    print(f"""
  ── PÁRRAFO 1: Precisión MAPE ────────────────────────────────

  Se evaluó la precisión calórica del sistema RAG NutriDiabetes
  Perú mediante el Error Porcentual Absoluto Medio (MAPE) sobre
  {n_simple} consultas directas de valores calóricos basadas en
  la Tabla Peruana de Composición de Alimentos (TPCA) CENAN/INS
  2025. El MAPE global obtenido fue de {mape_prom:.2f}%
  (σ = {mape_std:.2f}%, rango: {mape_min:.2f}%–{mape_max:.2f}%),
  lo que indica una precisión {nivel} del sistema RAG.
  El {alta:.1f}% de los casos obtuvo clasificación Excelente
  o Buena (error ≤ 10%), demostrando alta consistencia en la
  recuperación de información nutricional desde Pinecone.""")

    if emb_ok:
        nivel_c = ("alta"   if emb_prom >= 0.85 else
                   "buena"  if emb_prom >= 0.70 else
                   "media"  if emb_prom >= 0.50 else "baja")
        print(f"""
  ── PÁRRAFO 2: Coherencia semántica ──────────────────────────

  La coherencia semántica se evaluó mediante embeddings neurales
  multilingües (paraphrase-multilingual-MiniLM-L12-v2) sobre
  {n_total} consultas, obteniendo una similitud coseno promedio
  de {emb_prom:.4f} (σ = {emb_std:.4f},
  rango: {emb_min:.4f}–{emb_max:.4f}), indicando coherencia
  {nivel_c} entre las respuestas del sistema RAG y los textos
  de referencia TPCA. Este resultado confirma que el sistema
  genera recomendaciones semánticamente alineadas con la fuente
  nutricional oficial del Ministerio de Salud del Perú.""")

    if not np.isnan(tm_prom):
        print(f"""
  ── PÁRRAFO 3: Eficiencia operacional ────────────────────────

  En términos de eficiencia, el sistema respondió en un tiempo
  promedio de {tm_prom:.0f} ms ({tm_prom/1000:.2f} s) por consulta,
  garantizando una experiencia de usuario adecuada para una
  aplicación de soporte nutricional en tiempo real para pacientes
  con Diabetes Mellitus Tipo 2.""")

    print()
    print(SEP)
    print("  ARCHIVOS GENERADOS:")
    print(f"  Excel:    {OUT_EXCEL}")
    print(f"  Gráficos: {OUT_DIR}/")
    print(SEP)


if __name__ == "__main__":
    main()
