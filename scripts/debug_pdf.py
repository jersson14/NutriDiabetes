"""
Script de diagnóstico: muestra la estructura EXACTA de las tablas
en las páginas de datos del PDF.
"""
import pdfplumber
import os

PDF_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tpca-2025-2.pdf")

with pdfplumber.open(PDF_PATH) as pdf:
    # Revisar páginas donde deberían estar los datos (15-30)
    for i in [14, 15, 16, 17, 18, 19, 20, 25, 30, 50, 80]:
        if i >= len(pdf.pages):
            break
        
        page = pdf.pages[i]
        texto = page.extract_text() or ""
        tablas = page.extract_tables() or []
        
        print(f"\n{'='*70}")
        print(f"📄 PÁGINA {i+1}")
        print(f"{'='*70}")
        print(f"Texto primeros 200 chars: {texto[:200]}")
        print(f"Tablas encontradas: {len(tablas)}")
        
        for t_idx, tabla in enumerate(tablas):
            if not tabla:
                continue
            print(f"\n  📊 Tabla {t_idx+1}: {len(tabla)} filas x {len(tabla[0]) if tabla[0] else 0} cols")
            
            # Mostrar TODAS las filas (max 10)
            for r_idx, fila in enumerate(tabla[:10]):
                print(f"    Fila {r_idx}: {fila}")
            
            if len(tabla) > 10:
                print(f"    ... ({len(tabla)-10} filas más)")
        
        if not tablas:
            # Intentar con configuración diferente
            tablas2 = page.extract_tables(table_settings={
                "vertical_strategy": "text",
                "horizontal_strategy": "text"
            }) or []
            print(f"\n  Reintento con text strategy: {len(tablas2)} tablas")
            for t_idx, tabla in enumerate(tablas2[:1]):
                if tabla:
                    print(f"  Tabla {t_idx+1}: {len(tabla)} filas x {len(tabla[0]) if tabla[0] else 0} cols")
                    for r_idx, fila in enumerate(tabla[:5]):
                        print(f"    Fila {r_idx}: {fila}")

print("\n✅ Diagnóstico completado. Copia y pega TODO aquí.")
