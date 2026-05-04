"""
Script rápido para analizar la estructura de los PDFs
Ejecutar: python analizar_pdfs.py
"""
import pdfplumber
import os

def analizar_pdf(ruta):
    print(f"\n{'='*70}")
    print(f"📄 ANALIZANDO: {os.path.basename(ruta)}")
    print(f"{'='*70}")
    
    try:
        with pdfplumber.open(ruta) as pdf:
            total = len(pdf.pages)
            print(f"📊 Total de páginas: {total}")
            
            # Mostrar primeras páginas para ver portada/índice
            paginas_muestra = [0, 1, 2, 3, 4, 5, 9, 14, 19, 29]
            
            for i in paginas_muestra:
                if i >= total:
                    break
                texto = pdf.pages[i].extract_text() or ""
                tablas = pdf.pages[i].extract_tables() or []
                
                print(f"\n--- Página {i+1}/{total} ---")
                print(f"  Texto ({len(texto)} chars): {texto[:300].strip()}")
                print(f"  Tablas encontradas: {len(tablas)}")
                
                if tablas:
                    for t_idx, tabla in enumerate(tablas):
                        if tabla and len(tabla) > 0:
                            print(f"    Tabla {t_idx+1}: {len(tabla)} filas x {len(tabla[0]) if tabla[0] else 0} columnas")
                            # Mostrar encabezado y primera fila de datos
                            if len(tabla) >= 1:
                                print(f"    Encabezado: {tabla[0][:8]}")
                            if len(tabla) >= 2:
                                print(f"    Fila 1:     {tabla[1][:8]}")
                            if len(tabla) >= 3:
                                print(f"    Fila 2:     {tabla[2][:8]}")
                
                print()
                
    except Exception as e:
        print(f"❌ Error: {e}")
        print("   Instala pdfplumber: pip install pdfplumber")


# Buscar PDFs en el directorio actual
directorio = os.path.dirname(os.path.abspath(__file__))
pdfs = [f for f in os.listdir(directorio) if f.lower().endswith('.pdf')]

if not pdfs:
    print("❌ No se encontraron PDFs en la carpeta scripts/")
else:
    print(f"📁 PDFs encontrados: {pdfs}")
    for pdf_name in pdfs:
        analizar_pdf(os.path.join(directorio, pdf_name))

print("\n✅ Análisis completado. Copia y pega el resultado aquí.")
