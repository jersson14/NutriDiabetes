"""
============================================================
EXTRACTOR DE DATOS: Tabla Peruana de Composición de Alimentos (TPCA)
============================================================
Script para extraer datos nutricionales del PDF del CENAN/INS
y convertirlos a formato SQL para insertar en PostgreSQL.

Uso:
    1. Instalar dependencias: pip install pdfplumber pandas openpyxl
    2. Colocar el PDF en la carpeta 'data/'
    3. Ejecutar: python extraer_pdf_alimentos.py
    
Salida:
    - data/alimentos_extraidos.csv  → CSV con todos los alimentos
    - data/alimentos_extraidos.xlsx → Excel para revisión manual
    - ../database/seed_alimentos.sql → Script SQL listo para PostgreSQL
"""

import pdfplumber
import pandas as pd
import re
import os
import json
from pathlib import Path

# ============================================================
# CONFIGURACIÓN
# ============================================================

# Ruta del PDF (modificar según tu archivo)
PDF_PATH = os.path.join(os.path.dirname(__file__), "data", "tabla_peruana_alimentos.pdf")

# Directorio de salida
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
SQL_OUTPUT = os.path.join(os.path.dirname(__file__), "..", "database", "seed_alimentos.sql")

# Mapeo de categorías según la TPCA del CENAN
CATEGORIAS_TPCA = {
    1: "Cereales y derivados",
    2: "Verduras, hortalizas y derivados",
    3: "Frutas y derivados",
    4: "Grasas, aceites y oleaginosas",
    5: "Pescados y mariscos",
    6: "Carnes y derivados",
    7: "Leche y derivados",
    8: "Huevos y derivados",
    9: "Leguminosas y derivados",
    10: "Tubérculos, raíces y derivados",
    11: "Azúcares y derivados",
    12: "Misceláneos",
    13: "Bebidas",
    14: "Preparaciones y comidas",
}

# Columnas esperadas en la TPCA (por 100g de porción comestible)
COLUMNAS_NUTRIENTES = [
    "codigo",           # Código TPCA
    "nombre",           # Nombre del alimento
    "energia_kcal",     # Energía (kcal)
    "agua_g",           # Agua (g)
    "proteinas_g",      # Proteínas (g)
    "grasas_totales_g", # Grasa total (g)
    "carbohidratos_totales_g",  # Carbohidratos totales (g)
    "fibra_dietaria_g",         # Fibra (g)
    "cenizas_g",                # Cenizas (g)
    "calcio_mg",        # Calcio (mg)
    "fosforo_mg",       # Fósforo (mg)
    "hierro_mg",        # Hierro (mg)
    "vitamina_c_mg",    # Vitamina C (mg)
]

# Índice glucémico de referencia para alimentos peruanos comunes
# Fuentes: International Tables of Glycemic Index (2021), literatura peruana
IG_REFERENCIA = {
    # Cereales
    "quinua": 53, "kiwicha": 35, "cañihua": 45,
    "avena": 55, "arroz blanco": 73, "arroz integral": 50,
    "trigo": 41, "maíz": 52, "fideos": 44,
    "pan blanco": 75, "pan integral": 51,
    
    # Tubérculos
    "papa blanca": 77, "papa amarilla": 70, "papa huayro": 65,
    "camote": 61, "yuca": 46, "olluco": 55,
    "oca": 58, "mashua": 50, "chuño": 68,
    
    # Leguminosas (IG bajo - excelentes para DM2)
    "frijol": 28, "lenteja": 26, "garbanzo": 28,
    "pallar": 31, "tarwi": 15, "habas": 40,
    "arvejas": 22, "chocho": 15,
    
    # Frutas
    "manzana": 36, "naranja": 43, "mandarina": 42,
    "plátano": 51, "plátano verde": 40, "plátano isla": 55,
    "papaya": 60, "piña": 59, "mango": 51,
    "aguaymanto": 25, "lúcuma": 40, "chirimoya": 54,
    "guayaba": 20, "granadilla": 25, "tuna": 40,
    "palta": 15, "camu camu": 20,
    
    # Verduras (IG muy bajo en general)
    "tomate": 15, "cebolla": 10, "zanahoria": 47,
    "zapallo": 75, "brócoli": 15, "espinaca": 15,
    "lechuga": 15, "apio": 15, "pimiento": 15,
    "ají amarillo": 15, "pepino": 15,
    
    # Lácteos
    "leche": 27, "yogurt": 36, "queso": 0,
    
    # Proteínas animales (IG = 0)
    "pollo": 0, "res": 0, "cerdo": 0, "cuy": 0,
    "alpaca": 0, "pescado": 0, "bonito": 0,
    "jurel": 0, "trucha": 0, "camarones": 0,
    "huevo": 0, "hígado": 0,
    
    # Azúcares (IG alto - evitar en DM2)
    "azúcar": 65, "miel": 61, "chancaca": 65,
    "panela": 65, "mermelada": 65,
}


def limpiar_valor(valor):
    """Limpia y convierte un valor numérico extraído del PDF."""
    if valor is None or valor == "" or valor == "-" or valor == "...":
        return None
    
    # Remover espacios y caracteres no numéricos (excepto punto y coma)
    valor = str(valor).strip()
    valor = valor.replace(",", ".")
    valor = re.sub(r"[^\d.\-]", "", valor)
    
    try:
        return float(valor)
    except ValueError:
        return None


def detectar_categoria(texto):
    """Detecta a qué categoría de la TPCA pertenece un encabezado."""
    texto_lower = texto.lower().strip()
    
    for cat_id, cat_nombre in CATEGORIAS_TPCA.items():
        if cat_nombre.lower() in texto_lower:
            return cat_id
    
    # Buscar por palabras clave
    keywords = {
        1: ["cereal", "arroz", "trigo", "maíz", "avena"],
        2: ["verdura", "hortaliza", "tomate", "cebolla"],
        3: ["fruta", "manzana", "naranja", "plátano"],
        4: ["grasa", "aceite", "oleaginosa", "maní"],
        5: ["pescado", "marisco", "bonito", "jurel"],
        6: ["carne", "pollo", "res", "cerdo"],
        7: ["leche", "lácteo", "yogurt", "queso"],
        8: ["huevo"],
        9: ["leguminosa", "frijol", "lenteja", "menestra"],
        10: ["tubérculo", "raíz", "papa", "camote", "yuca"],
        11: ["azúcar", "miel", "dulce"],
        12: ["misceláneo", "condimento", "especia"],
        13: ["bebida", "jugo", "chicha"],
        14: ["preparación", "plato", "comida"],
    }
    
    for cat_id, words in keywords.items():
        for word in words:
            if word in texto_lower:
                return cat_id
    
    return None


def obtener_ig(nombre_alimento):
    """Busca el índice glucémico para un alimento dado."""
    nombre_lower = nombre_alimento.lower()
    
    for key, ig_valor in IG_REFERENCIA.items():
        if key in nombre_lower:
            return ig_valor
    
    return None


def clasificar_para_dm2(ig, carbohidratos, fibra):
    """
    Clasifica un alimento según su aptitud para pacientes con DM2.
    Retorna: (nivel_recomendacion, es_apto_diabeticos)
    """
    if ig is not None:
        if ig <= 55:
            return "RECOMENDADO", True
        elif ig <= 69:
            return "MODERADO", True
        else:
            return "LIMITAR", False
    
    # Si no hay IG, evaluar por carbohidratos y fibra
    if carbohidratos is not None:
        if carbohidratos < 10:
            return "RECOMENDADO", True
        elif carbohidratos < 30 and fibra and fibra > 3:
            return "MODERADO", True
        elif carbohidratos > 50:
            return "LIMITAR", False
    
    return "POR_EVALUAR", True


def extraer_tablas_pdf(pdf_path):
    """
    Extrae tablas nutricionales del PDF de la TPCA.
    Adaptar esta función según la estructura específica de tu PDF.
    """
    print(f"📄 Abriendo PDF: {pdf_path}")
    
    todos_alimentos = []
    categoria_actual = 1  # Empezar con cereales
    
    with pdfplumber.open(pdf_path) as pdf:
        total_paginas = len(pdf.pages)
        print(f"📊 Total de páginas: {total_paginas}")
        
        for i, page in enumerate(pdf.pages):
            print(f"  Procesando página {i+1}/{total_paginas}...", end="\r")
            
            # Extraer texto para detectar categorías
            texto_pagina = page.extract_text() or ""
            
            # Verificar si hay un encabezado de categoría
            cat_detectada = detectar_categoria(texto_pagina[:200])
            if cat_detectada:
                categoria_actual = cat_detectada
            
            # Extraer tablas
            tablas = page.extract_tables()
            
            for tabla in tablas:
                if not tabla or len(tabla) < 2:
                    continue
                
                for fila in tabla[1:]:  # Saltar encabezado
                    if not fila or len(fila) < 5:
                        continue
                    
                    # Intentar extraer datos (estructura típica TPCA)
                    try:
                        alimento = {
                            "codigo_tpca": str(fila[0]).strip() if fila[0] else None,
                            "nombre": str(fila[1]).strip() if len(fila) > 1 and fila[1] else None,
                            "categoria_id": categoria_actual,
                        }
                        
                        # Verificar que tiene nombre válido
                        if not alimento["nombre"] or len(alimento["nombre"]) < 2:
                            continue
                        
                        # Extraer valores nutricionales según posición en la tabla
                        campos = [
                            "energia_kcal", "agua_g", "proteinas_g",
                            "grasas_totales_g", "carbohidratos_totales_g",
                            "fibra_dietaria_g", "cenizas_g",
                            "calcio_mg", "fosforo_mg", "hierro_mg",
                            "vitamina_c_mg"
                        ]
                        
                        for j, campo in enumerate(campos):
                            idx = j + 2  # Offset por código y nombre
                            if idx < len(fila):
                                alimento[campo] = limpiar_valor(fila[idx])
                            else:
                                alimento[campo] = None
                        
                        # Agregar IG y clasificación DM2
                        alimento["indice_glucemico"] = obtener_ig(alimento["nombre"])
                        
                        nivel_rec, es_apto = clasificar_para_dm2(
                            alimento["indice_glucemico"],
                            alimento.get("carbohidratos_totales_g"),
                            alimento.get("fibra_dietaria_g")
                        )
                        alimento["nivel_recomendacion"] = nivel_rec
                        alimento["es_apto_diabeticos"] = es_apto
                        
                        todos_alimentos.append(alimento)
                        
                    except Exception as e:
                        continue
    
    print(f"\n✅ Total de alimentos extraídos: {len(todos_alimentos)}")
    return todos_alimentos


def generar_csv(alimentos, output_dir):
    """Genera archivo CSV y Excel con los datos extraídos."""
    os.makedirs(output_dir, exist_ok=True)
    
    df = pd.DataFrame(alimentos)
    
    # Agregar nombre de categoría
    df["categoria_nombre"] = df["categoria_id"].map(CATEGORIAS_TPCA)
    
    # CSV
    csv_path = os.path.join(output_dir, "alimentos_extraidos.csv")
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"📁 CSV guardado: {csv_path}")
    
    # Excel
    xlsx_path = os.path.join(output_dir, "alimentos_extraidos.xlsx")
    df.to_excel(xlsx_path, index=False, engine="openpyxl")
    print(f"📁 Excel guardado: {xlsx_path}")
    
    return df


def escapar_sql(texto):
    """Escapa caracteres especiales para SQL."""
    if texto is None:
        return "NULL"
    texto = str(texto).replace("'", "''")
    return f"'{texto}'"


def valor_sql(valor):
    """Convierte un valor Python a formato SQL."""
    if valor is None:
        return "NULL"
    if isinstance(valor, bool):
        return "TRUE" if valor else "FALSE"
    if isinstance(valor, (int, float)):
        return str(valor)
    return escapar_sql(valor)


def generar_sql(alimentos, sql_path):
    """Genera el script SQL para insertar los alimentos."""
    os.makedirs(os.path.dirname(sql_path), exist_ok=True)
    
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- ============================================================\n")
        f.write("-- SEED: Alimentos - Tabla Peruana de Composición de Alimentos\n")
        f.write("-- Generado automáticamente desde PDF del CENAN/INS\n")
        f.write(f"-- Total de alimentos: {len(alimentos)}\n")
        f.write("-- ============================================================\n\n")
        f.write("-- IMPORTANTE: Ejecutar después de init_database.sql y seed_categorias.sql\n\n")
        f.write("BEGIN;\n\n")
        
        # Agrupar por categoría
        from collections import defaultdict
        por_categoria = defaultdict(list)
        for a in alimentos:
            por_categoria[a["categoria_id"]].append(a)
        
        for cat_id in sorted(por_categoria.keys()):
            cat_nombre = CATEGORIAS_TPCA.get(cat_id, f"Categoría {cat_id}")
            alimentos_cat = por_categoria[cat_id]
            
            f.write(f"-- {'='*60}\n")
            f.write(f"-- Categoría {cat_id}: {cat_nombre} ({len(alimentos_cat)} alimentos)\n")
            f.write(f"-- {'='*60}\n\n")
            
            for a in alimentos_cat:
                f.write("INSERT INTO alimentos (\n")
                f.write("    codigo_tpca, nombre, categoria_id,\n")
                f.write("    energia_kcal, agua_g, proteinas_g, grasas_totales_g,\n")
                f.write("    carbohidratos_totales_g, fibra_dietaria_g, cenizas_g,\n")
                f.write("    calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg,\n")
                f.write("    indice_glucemico, nivel_recomendacion, es_apto_diabeticos\n")
                f.write(") VALUES (\n")
                f.write(f"    {escapar_sql(a.get('codigo_tpca'))}, ")
                f.write(f"{escapar_sql(a.get('nombre'))}, ")
                f.write(f"{a.get('categoria_id', 1)},\n")
                f.write(f"    {valor_sql(a.get('energia_kcal'))}, ")
                f.write(f"{valor_sql(a.get('agua_g'))}, ")
                f.write(f"{valor_sql(a.get('proteinas_g'))}, ")
                f.write(f"{valor_sql(a.get('grasas_totales_g'))},\n")
                f.write(f"    {valor_sql(a.get('carbohidratos_totales_g'))}, ")
                f.write(f"{valor_sql(a.get('fibra_dietaria_g'))}, ")
                f.write(f"{valor_sql(a.get('cenizas_g'))},\n")
                f.write(f"    {valor_sql(a.get('calcio_mg'))}, ")
                f.write(f"{valor_sql(a.get('fosforo_mg'))}, ")
                f.write(f"{valor_sql(a.get('hierro_mg'))}, ")
                f.write(f"{valor_sql(a.get('vitamina_c_mg'))},\n")
                f.write(f"    {valor_sql(a.get('indice_glucemico'))}, ")
                f.write(f"'{a.get('nivel_recomendacion', 'POR_EVALUAR')}', ")
                f.write(f"{'TRUE' if a.get('es_apto_diabeticos', True) else 'FALSE'}\n")
                f.write(");\n\n")
        
        f.write("COMMIT;\n\n")
        f.write(f"-- Para verificar:\n")
        f.write(f"-- SELECT ca.nombre, COUNT(*) as total\n")
        f.write(f"-- FROM alimentos a JOIN categorias_alimentos ca ON a.categoria_id = ca.id\n")
        f.write(f"-- GROUP BY ca.nombre ORDER BY ca.id;\n")
    
    print(f"📁 SQL guardado: {sql_path}")


def crear_datos_desde_csv_manual(csv_path):
    """
    Alternativa: Si el PDF no se puede procesar automáticamente,
    puedes ingresar los datos manualmente en un CSV con las columnas:
    codigo,nombre,categoria_id,energia_kcal,agua_g,proteinas_g,
    grasas_totales_g,carbohidratos_totales_g,fibra_dietaria_g,
    cenizas_g,calcio_mg,fosforo_mg,hierro_mg,vitamina_c_mg
    """
    print(f"📄 Leyendo CSV manual: {csv_path}")
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    
    alimentos = []
    for _, row in df.iterrows():
        alimento = row.to_dict()
        
        # Agregar IG y clasificación
        nombre = str(alimento.get("nombre", ""))
        alimento["indice_glucemico"] = obtener_ig(nombre)
        
        nivel_rec, es_apto = clasificar_para_dm2(
            alimento["indice_glucemico"],
            alimento.get("carbohidratos_totales_g"),
            alimento.get("fibra_dietaria_g")
        )
        alimento["nivel_recomendacion"] = nivel_rec
        alimento["es_apto_diabeticos"] = es_apto
        
        alimentos.append(alimento)
    
    return alimentos


# ============================================================
# EJECUCIÓN PRINCIPAL
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("🍎 EXTRACTOR - Tabla Peruana de Composición de Alimentos")
    print("   Para el Sistema de Recomendaciones NutriDiabetes Perú")
    print("=" * 60)
    print()
    
    # Crear directorio de datos
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Opción 1: Extraer del PDF
    if os.path.exists(PDF_PATH):
        print("📌 Modo: Extracción desde PDF")
        alimentos = extraer_tablas_pdf(PDF_PATH)
        
        if alimentos:
            df = generar_csv(alimentos, OUTPUT_DIR)
            generar_sql(alimentos, SQL_OUTPUT)
            
            # Estadísticas
            print("\n" + "=" * 60)
            print("📊 ESTADÍSTICAS DE EXTRACCIÓN:")
            print("=" * 60)
            print(f"  Total alimentos: {len(alimentos)}")
            
            df_temp = pd.DataFrame(alimentos)
            for cat_id, cat_nombre in CATEGORIAS_TPCA.items():
                count = len(df_temp[df_temp["categoria_id"] == cat_id])
                if count > 0:
                    print(f"  📁 {cat_nombre}: {count}")
            
            # Resumen DM2
            recomendados = len(df_temp[df_temp["nivel_recomendacion"] == "RECOMENDADO"])
            moderados = len(df_temp[df_temp["nivel_recomendacion"] == "MODERADO"])
            limitar = len(df_temp[df_temp["nivel_recomendacion"] == "LIMITAR"])
            por_evaluar = len(df_temp[df_temp["nivel_recomendacion"] == "POR_EVALUAR"])
            
            print(f"\n  🟢 Recomendados para DM2: {recomendados}")
            print(f"  🟡 Moderados para DM2: {moderados}")
            print(f"  🔴 Limitar en DM2: {limitar}")
            print(f"  ⚪ Por evaluar: {por_evaluar}")
        else:
            print("⚠️ No se pudieron extraer datos del PDF.")
            print("   El formato del PDF puede requerir ajustes en el script.")
            print("   Alternativa: Usa la opción de CSV manual (ver abajo).")
    
    # Opción 2: Desde CSV manual
    else:
        csv_manual = os.path.join(OUTPUT_DIR, "alimentos_manual.csv")
        
        if os.path.exists(csv_manual):
            print("📌 Modo: Lectura desde CSV manual")
            alimentos = crear_datos_desde_csv_manual(csv_manual)
            generar_csv(alimentos, OUTPUT_DIR)
            generar_sql(alimentos, SQL_OUTPUT)
        else:
            print("⚠️ No se encontró el PDF ni un CSV manual.")
            print(f"\nOpciones:")
            print(f"  1. Coloca el PDF en: {PDF_PATH}")
            print(f"  2. Crea un CSV manual en: {csv_manual}")
            print(f"\nFormato del CSV:")
            print(f"  codigo,nombre,categoria_id,energia_kcal,agua_g,proteinas_g,")
            print(f"  grasas_totales_g,carbohidratos_totales_g,fibra_dietaria_g,")
            print(f"  cenizas_g,calcio_mg,fosforo_mg,hierro_mg,vitamina_c_mg")
            
            # Crear CSV plantilla
            plantilla_path = os.path.join(OUTPUT_DIR, "plantilla_alimentos.csv")
            with open(plantilla_path, "w", encoding="utf-8-sig") as f:
                f.write("codigo,nombre,categoria_id,energia_kcal,agua_g,proteinas_g,")
                f.write("grasas_totales_g,carbohidratos_totales_g,fibra_dietaria_g,")
                f.write("cenizas_g,calcio_mg,fosforo_mg,hierro_mg,vitamina_c_mg\n")
                # Ejemplo
                f.write("C001,Quinua grano seco,1,343.0,11.8,13.6,5.8,66.6,9.4,2.2,56.0,387.0,7.5,0.0\n")
                f.write("V001,Espinaca hojas,2,26.0,90.0,2.6,0.5,4.9,3.3,2.0,93.0,55.0,2.4,33.0\n")
                f.write("F001,Aguaymanto fruto,3,54.0,79.6,1.5,0.5,18.5,5.4,0.7,7.0,37.0,0.8,26.0\n")
            
            print(f"\n✅ Plantilla CSV creada en: {plantilla_path}")
            print(f"   Llénala con los datos del PDF y vuelve a ejecutar el script.")
    
    print("\n✅ Proceso finalizado.")
