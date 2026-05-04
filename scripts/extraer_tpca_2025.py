"""
============================================================
EXTRACTOR TPCA 2025 → PostgreSQL + Pinecone
============================================================
Estructura real del PDF (27 columnas):
  [0] Letra categoría (A, B, C...)
  [1] Número alimento (1, 2, 3...)
  [2] Nombre del alimento
  [3] Energía kcal
  [4] Energía kJ
  [5] Agua g
  [6] Proteínas g
  [7] Grasa total g
  [8] Carbohidratos totales g
  [9] Carbohidratos disponibles g
  [10] Fibra dietaria g
  [11] Cenizas g
  [12] Calcio mg
  [13] Fósforo mg
  [14] Zinc mg
  [15] Hierro mg
  [16] Sodio mg
  [17] Potasio mg
  [18] β-caroteno eq. totales µg
  [19] Vitamina A eq. totales µg
  [20] Tiamina mg
  [21] Riboflavina mg
  [22] Niacina mg
  [23] Vitamina C mg
  [24] Ácido fólico µg
  [25] Letra (repetida)
  [26] Número (repetido)

Uso:  pip install pdfplumber pandas python-dotenv
      python extraer_tpca_2025.py
"""

import pdfplumber
import pandas as pd
import re
import os
import json
from collections import defaultdict

# ============================================================
# CONFIGURACIÓN
# ============================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(SCRIPT_DIR, "tpca-2025-2.pdf")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "data")
SQL_OUTPUT = os.path.join(SCRIPT_DIR, "..", "database", "seed_alimentos.sql")
PINECONE_CHUNKS_OUTPUT = os.path.join(OUTPUT_DIR, "pinecone_chunks.json")

# Páginas a saltar (portada, créditos, índice, intro, definiciones)
PAGINAS_SALTAR = 14

# Letras de categoría válidas
LETRAS_VALIDAS = set("ABCDEFGHIJKLMNPQ")

# Mapeo de letra → categoría
CATEGORIAS = {
    'A': {'id': 1, 'nombre': 'Cereales y derivados'},
    'B': {'id': 2, 'nombre': 'Verduras, hortalizas y derivados'},
    'C': {'id': 3, 'nombre': 'Frutas y derivados'},
    'D': {'id': 4, 'nombre': 'Grasas, aceites y oleaginosas'},
    'E': {'id': 5, 'nombre': 'Pescados y mariscos'},
    'F': {'id': 6, 'nombre': 'Carnes y derivados'},
    'G': {'id': 7, 'nombre': 'Leche y derivados'},
    'H': {'id': 8, 'nombre': 'Bebidas (alcohólicas y analcohólicas)'},
    'I': {'id': 9, 'nombre': 'Huevos y derivados'},
    'J': {'id': 10, 'nombre': 'Leguminosas y derivados'},
    'K': {'id': 11, 'nombre': 'Tubérculos, raíces y derivados'},
    'L': {'id': 12, 'nombre': 'Azúcares y derivados'},
    'M': {'id': 13, 'nombre': 'Misceláneos'},
    'N': {'id': 14, 'nombre': 'Alimentos infantiles'},
    'P': {'id': 15, 'nombre': 'Preparaciones y comidas'},
    'Q': {'id': 16, 'nombre': 'Alimentos de regímenes especiales'},
}

# IG de referencia para alimentos peruanos
IG_REFERENCIA = {
    "quinua": 53, "kiwicha": 35, "cañihua": 45, "kañiwa": 45,
    "amaranto": 35, "avena": 55, "arroz blanco": 73, "arroz integral": 50,
    "arroz pilado": 73, "arroz": 73, "trigo": 41, "maíz": 52,
    "fideos": 44, "fideo": 44, "pasta": 44,
    "pan blanco": 75, "pan integral": 51, "pan": 75,
    "galleta": 70, "harina de trigo": 60, "harina": 60,
    "cebada": 28, "centeno": 34, "mote": 52,
    "papa blanca": 77, "papa amarilla": 70, "papa": 77,
    "camote": 61, "yuca": 46, "olluco": 55,
    "oca": 58, "mashua": 50, "chuño": 68,
    "frijol": 28, "frejol": 28, "lenteja": 26, "garbanzo": 28,
    "pallar": 31, "tarwi": 15, "chocho": 15, "habas": 40,
    "arvejas": 22, "arveja": 22, "soya": 16, "soja": 16,
    "manzana": 36, "naranja": 43, "mandarina": 42,
    "plátano": 51, "plátano verde": 40, "banana": 51,
    "papaya": 60, "piña": 59, "mango": 51,
    "aguaymanto": 25, "lúcuma": 40, "lucuma": 40,
    "chirimoya": 54, "guayaba": 20, "granadilla": 25,
    "tuna": 40, "palta": 15, "aguacate": 15,
    "camu camu": 20, "aguaje": 35, "maracuyá": 30,
    "tomate": 15, "cebolla": 10, "zanahoria": 47,
    "zapallo": 75, "brócoli": 15, "espinaca": 15,
    "lechuga": 15, "apio": 15, "pimiento": 15,
    "ají": 15, "pepino": 15, "alcachofa": 15,
    "leche": 27, "yogurt": 36, "queso": 0,
    "pollo": 0, "res": 0, "cerdo": 0, "cuy": 0,
    "alpaca": 0, "pescado": 0, "bonito": 0,
    "jurel": 0, "trucha": 0, "camarón": 0,
    "huevo": 0, "hígado": 0, "atún": 0, "sardina": 0,
    "cordero": 0, "cabrito": 0, "pavo": 0,
    "azúcar": 65, "miel": 61, "chancaca": 65,
    "panela": 65, "mermelada": 65, "tamarindo": 23,
    "uva": 46, "uvilla": 25, "toronja": 25, "limón": 20,
    "aceituna": 15,
}


def limpiar_valor(valor):
    """Convierte un valor del PDF a float, manejando símbolos especiales."""
    if valor is None:
        return None
    
    s = str(valor).strip()
    
    # Valores no numéricos
    if s in ("", "-", "...", "—", "–", "•", "Tr", "tr", "*"):
        return None
    
    # Limpiar caracteres especiales
    s = s.replace(",", ".").replace("*", "").replace("†", "").replace("‡", "")
    s = re.sub(r"[^\d.\-]", "", s)
    
    if not s or s in (".", "-"):
        return None
    
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def obtener_ig(nombre):
    """Busca el IG para un alimento dado (búsqueda parcial)."""
    nombre_lower = nombre.lower()
    for key, ig in sorted(IG_REFERENCIA.items(), key=lambda x: -len(x[0])):
        if key in nombre_lower:
            return ig
    return None


def clasificar_dm2(ig, carbohidratos, fibra):
    """Clasifica aptitud para DM2."""
    if ig is not None:
        if ig <= 55:
            return "RECOMENDADO", True
        elif ig <= 69:
            return "MODERADO", True
        else:
            return "LIMITAR", False
    
    if carbohidratos is not None:
        if carbohidratos < 10:
            return "RECOMENDADO", True
        elif carbohidratos < 30:
            if fibra and fibra > 3:
                return "RECOMENDADO", True
            return "MODERADO", True
        elif carbohidratos > 50:
            return "LIMITAR", False
    
    return "POR_EVALUAR", True


def es_fila_dato(fila):
    """
    Verifica si una fila contiene datos de alimento.
    Formato real: ['A', '1', 'Nombre del alimento', '351', '1469', ...]
    """
    if not fila or len(fila) < 5:
        return False
    
    # Columna 0: debe ser una letra de categoría válida
    col0 = str(fila[0] or "").strip()
    if len(col0) != 1 or col0 not in LETRAS_VALIDAS:
        return False
    
    # Columna 1: debe ser un número
    col1 = str(fila[1] or "").strip()
    if not col1 or not col1.isdigit():
        return False
    
    # Columna 2: debe ser el nombre (texto no vacío, no numérico)
    col2 = str(fila[2] or "").strip()
    if len(col2) < 2:
        return False
    
    return True


def extraer_alimentos(pdf_path):
    """Extrae todos los alimentos del PDF."""
    print(f"📄 Abriendo: {os.path.basename(pdf_path)}")
    
    alimentos = []
    codigos_vistos = set()
    errores = 0
    por_categoria = defaultdict(int)
    
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        print(f"📊 {total} páginas. Saltando primeras {PAGINAS_SALTAR} (portada/intro)")
        
        for i in range(PAGINAS_SALTAR, total):
            page = pdf.pages[i]
            tablas = page.extract_tables() or []
            
            for tabla in tablas:
                if not tabla or len(tabla) < 3:
                    continue
                
                for fila in tabla:
                    if not es_fila_dato(fila):
                        continue
                    
                    try:
                        letra = fila[0].strip()
                        numero = fila[1].strip()
                        codigo = f"{letra} {numero}"
                        nombre = re.sub(r'\s+', ' ', str(fila[2]).strip().replace('\n', ' '))
                        
                        # Evitar duplicados
                        if codigo in codigos_vistos:
                            continue
                        codigos_vistos.add(codigo)
                        
                        # Obtener categoría
                        cat = CATEGORIAS.get(letra, {'id': 99, 'nombre': 'Otros'})
                        
                        # Extraer valores (columnas 3 a 24)
                        energia_kcal = limpiar_valor(fila[3]) if len(fila) > 3 else None
                        energia_kj = limpiar_valor(fila[4]) if len(fila) > 4 else None
                        agua_g = limpiar_valor(fila[5]) if len(fila) > 5 else None
                        proteinas_g = limpiar_valor(fila[6]) if len(fila) > 6 else None
                        grasas_g = limpiar_valor(fila[7]) if len(fila) > 7 else None
                        carbo_totales_g = limpiar_valor(fila[8]) if len(fila) > 8 else None
                        carbo_disp_g = limpiar_valor(fila[9]) if len(fila) > 9 else None
                        fibra_g = limpiar_valor(fila[10]) if len(fila) > 10 else None
                        cenizas_g = limpiar_valor(fila[11]) if len(fila) > 11 else None
                        calcio_mg = limpiar_valor(fila[12]) if len(fila) > 12 else None
                        fosforo_mg = limpiar_valor(fila[13]) if len(fila) > 13 else None
                        zinc_mg = limpiar_valor(fila[14]) if len(fila) > 14 else None
                        hierro_mg = limpiar_valor(fila[15]) if len(fila) > 15 else None
                        sodio_mg = limpiar_valor(fila[16]) if len(fila) > 16 else None
                        potasio_mg = limpiar_valor(fila[17]) if len(fila) > 17 else None
                        beta_caroteno_ug = limpiar_valor(fila[18]) if len(fila) > 18 else None
                        vitamina_a_ug = limpiar_valor(fila[19]) if len(fila) > 19 else None
                        tiamina_mg = limpiar_valor(fila[20]) if len(fila) > 20 else None
                        riboflavina_mg = limpiar_valor(fila[21]) if len(fila) > 21 else None
                        niacina_mg = limpiar_valor(fila[22]) if len(fila) > 22 else None
                        vitamina_c_mg = limpiar_valor(fila[23]) if len(fila) > 23 else None
                        acido_folico_ug = limpiar_valor(fila[24]) if len(fila) > 24 else None
                        
                        # IG y clasificación DM2
                        ig = obtener_ig(nombre)
                        nivel, apto = clasificar_dm2(ig, carbo_totales_g, fibra_g)
                        
                        alimento = {
                            "codigo_tpca": codigo,
                            "nombre": nombre,
                            "categoria_id": cat['id'],
                            "categoria_nombre": cat['nombre'],
                            "energia_kcal": energia_kcal,
                            "energia_kj": energia_kj,
                            "agua_g": agua_g,
                            "proteinas_g": proteinas_g,
                            "grasas_totales_g": grasas_g,
                            "carbohidratos_totales_g": carbo_totales_g,
                            "carbohidratos_disponibles_g": carbo_disp_g,
                            "fibra_dietaria_g": fibra_g,
                            "cenizas_g": cenizas_g,
                            "calcio_mg": calcio_mg,
                            "fosforo_mg": fosforo_mg,
                            "zinc_mg": zinc_mg,
                            "hierro_mg": hierro_mg,
                            "sodio_mg": sodio_mg,
                            "potasio_mg": potasio_mg,
                            "vitamina_c_mg": vitamina_c_mg,
                            "tiamina_mg": tiamina_mg,
                            "riboflavina_mg": riboflavina_mg,
                            "niacina_mg": niacina_mg,
                            "acido_folico_ug": acido_folico_ug,
                            "indice_glucemico": ig,
                            "nivel_recomendacion": nivel,
                            "es_apto_diabeticos": apto,
                        }
                        
                        alimentos.append(alimento)
                        por_categoria[cat['nombre']] += 1
                        
                    except Exception as e:
                        errores += 1
                        continue
            
            # Progreso cada 20 páginas
            procesadas = i - PAGINAS_SALTAR + 1
            if procesadas % 20 == 0 or i == total - 1:
                print(f"  📖 Pág {i+1}/{total} — {len(alimentos)} alimentos extraídos")
    
    # Resumen
    print(f"\n{'='*60}")
    print(f"✅ EXTRACCIÓN COMPLETADA")
    print(f"{'='*60}")
    print(f"  Total: {len(alimentos)} alimentos")
    print(f"  Errores ignorados: {errores}")
    for cat, n in sorted(por_categoria.items()):
        print(f"  📁 {cat}: {n}")
    
    return alimentos


# ============================================================
# GENERADORES DE SALIDA
# ============================================================

def esc(texto):
    if texto is None: return "NULL"
    return f"'{str(texto).replace(chr(39), chr(39)+chr(39))}'"

def val(v):
    if v is None: return "NULL"
    if isinstance(v, bool): return "TRUE" if v else "FALSE"
    return str(v)


def generar_sql(alimentos, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write("-- SEED: Alimentos TPCA 2025 CENAN/INS\n")
        f.write(f"-- Total: {len(alimentos)} alimentos\n")
        f.write("-- Generado automáticamente por extraer_tpca_2025.py\n\n")
        f.write("BEGIN;\n\n")
        
        agrupado = defaultdict(list)
        for a in alimentos:
            agrupado[a['categoria_nombre']].append(a)
        
        for cat_nombre in sorted(agrupado.keys()):
            items = agrupado[cat_nombre]
            f.write(f"-- === {cat_nombre} ({len(items)}) ===\n\n")
            
            for a in items:
                f.write(f"INSERT INTO alimentos (codigo_tpca, nombre, categoria_id, "
                        f"energia_kcal, agua_g, proteinas_g, grasas_totales_g, "
                        f"carbohidratos_totales_g, carbohidratos_disponibles_g, "
                        f"fibra_dietaria_g, cenizas_g, calcio_mg, fosforo_mg, "
                        f"hierro_mg, zinc_mg, sodio_mg, potasio_mg, vitamina_c_mg, "
                        f"indice_glucemico, nivel_recomendacion, es_apto_diabeticos"
                        f") VALUES ("
                        f"{esc(a['codigo_tpca'])}, {esc(a['nombre'])}, {a['categoria_id']}, "
                        f"{val(a['energia_kcal'])}, {val(a['agua_g'])}, {val(a['proteinas_g'])}, "
                        f"{val(a['grasas_totales_g'])}, {val(a['carbohidratos_totales_g'])}, "
                        f"{val(a['carbohidratos_disponibles_g'])}, {val(a['fibra_dietaria_g'])}, "
                        f"{val(a['cenizas_g'])}, {val(a['calcio_mg'])}, {val(a['fosforo_mg'])}, "
                        f"{val(a['hierro_mg'])}, {val(a['zinc_mg'])}, {val(a['sodio_mg'])}, "
                        f"{val(a['potasio_mg'])}, {val(a['vitamina_c_mg'])}, "
                        f"{val(a['indice_glucemico'])}, '{a['nivel_recomendacion']}', "
                        f"{'TRUE' if a['es_apto_diabeticos'] else 'FALSE'}"
                        f") ON CONFLICT (codigo_tpca) DO UPDATE SET "
                        f"nombre=EXCLUDED.nombre, energia_kcal=EXCLUDED.energia_kcal, "
                        f"proteinas_g=EXCLUDED.proteinas_g;\n")
            f.write("\n")
        
        f.write("COMMIT;\n")
    
    print(f"📁 SQL: {path}")


def generar_chunks(alimentos, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    chunks = []
    for a in alimentos:
        nombre = a['nombre']
        cat = a['categoria_nombre']
        
        # Texto enriquecido para el embedding
        t = f"Alimento peruano: {nombre}. "
        t += f"Categoría TPCA: {cat}. "
        t += f"Código: {a['codigo_tpca']}. "
        t += "Composición por 100g de porción comestible: "
        
        if a['energia_kcal']: t += f"Energía {a['energia_kcal']} kcal. "
        if a['proteinas_g']: t += f"Proteínas {a['proteinas_g']}g. "
        if a['grasas_totales_g']: t += f"Grasas {a['grasas_totales_g']}g. "
        if a['carbohidratos_totales_g']: t += f"Carbohidratos totales {a['carbohidratos_totales_g']}g. "
        if a['carbohidratos_disponibles_g']: t += f"Carbohidratos disponibles {a['carbohidratos_disponibles_g']}g. "
        if a['fibra_dietaria_g']: t += f"Fibra dietaria {a['fibra_dietaria_g']}g. "
        if a['agua_g']: t += f"Agua {a['agua_g']}g. "
        if a['calcio_mg']: t += f"Calcio {a['calcio_mg']}mg. "
        if a['hierro_mg']: t += f"Hierro {a['hierro_mg']}mg. "
        if a['zinc_mg']: t += f"Zinc {a['zinc_mg']}mg. "
        if a['vitamina_c_mg']: t += f"Vitamina C {a['vitamina_c_mg']}mg. "
        if a['fosforo_mg']: t += f"Fósforo {a['fosforo_mg']}mg. "
        if a['sodio_mg']: t += f"Sodio {a['sodio_mg']}mg. "
        if a['potasio_mg']: t += f"Potasio {a['potasio_mg']}mg. "
        
        if a['indice_glucemico'] is not None:
            t += f"Índice Glucémico (IG): {a['indice_glucemico']}. "
            if a['indice_glucemico'] <= 55:
                t += "IG bajo, recomendado para diabetes. "
            elif a['indice_glucemico'] <= 69:
                t += "IG medio, consumir con moderación en diabetes. "
            else:
                t += "IG alto, limitar consumo en diabetes. "
        
        t += f"Clasificación DM2: {a['nivel_recomendacion']}. "
        
        if a['es_apto_diabeticos']:
            t += "Apto para pacientes con diabetes mellitus tipo 2. "
        else:
            t += "Consumir con precaución en diabetes mellitus tipo 2. "
        
        t += "Fuente: Tabla Peruana de Composición de Alimentos (TPCA) 2025, CENAN/INS, MINSA Perú."
        
        chunks.append({
            "id": a['codigo_tpca'].replace(" ", "_").lower(),
            "text": t,
            "metadata": {
                "codigo_tpca": a['codigo_tpca'],
                "nombre": nombre,
                "categoria": cat,
                "categoria_id": a['categoria_id'],
                "energia_kcal": a['energia_kcal'],
                "proteinas_g": a['proteinas_g'],
                "carbohidratos_g": a['carbohidratos_totales_g'],
                "fibra_g": a['fibra_dietaria_g'],
                "indice_glucemico": a['indice_glucemico'],
                "nivel_recomendacion": a['nivel_recomendacion'],
                "es_apto_diabeticos": a['es_apto_diabeticos'],
                "fuente": "TPCA 2025 CENAN/INS"
            }
        })
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)
    
    print(f"📁 Chunks Pinecone: {path} ({len(chunks)} chunks)")
    return chunks


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("🍎 EXTRACTOR TPCA 2025 → PostgreSQL + Pinecone")
    print("   NutriDiabetes Perú — CENAN/INS")
    print("=" * 60)
    
    if not os.path.exists(PDF_PATH):
        print(f"\n❌ No encontrado: {PDF_PATH}")
        exit(1)
    
    # 1. Extraer
    alimentos = extraer_alimentos(PDF_PATH)
    
    if not alimentos:
        print("\n❌ No se extrajeron alimentos")
        exit(1)
    
    # 2. CSV
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df = pd.DataFrame(alimentos)
    csv_path = os.path.join(OUTPUT_DIR, "tpca_2025_extraido.csv")
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"📁 CSV: {csv_path}")
    
    # 3. SQL
    generar_sql(alimentos, SQL_OUTPUT)
    
    # 4. Chunks Pinecone
    chunks = generar_chunks(alimentos, PINECONE_CHUNKS_OUTPUT)
    
    # 5. Resumen final
    rec = len(df[df["nivel_recomendacion"] == "RECOMENDADO"])
    mod = len(df[df["nivel_recomendacion"] == "MODERADO"])
    lim = len(df[df["nivel_recomendacion"] == "LIMITAR"])
    eva = len(df[df["nivel_recomendacion"] == "POR_EVALUAR"])
    
    print(f"\n{'='*60}")
    print("📊 RESUMEN PARA LA TESIS")
    print(f"{'='*60}")
    print(f"  📋 Total alimentos: {len(alimentos)}")
    print(f"  🟢 Recomendados DM2 (IG≤55): {rec}")
    print(f"  🟡 Moderados DM2 (IG 56-69): {mod}")
    print(f"  🔴 Limitar DM2 (IG≥70): {lim}")
    print(f"  ⚪ Por evaluar: {eva}")
    print(f"\n  Archivos generados:")
    print(f"    → data/tpca_2025_extraido.csv")
    print(f"    → database/seed_alimentos.sql")
    print(f"    → data/pinecone_chunks.json")
    print(f"\n🔜 Siguiente: python subir_a_pinecone.py")
