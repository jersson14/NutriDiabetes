"""
============================================================
GENERADOR DE DATA PARA EVALUACIÓN DEL SISTEMA RAG
NutriDiabetes Perú - Instrumento de Validación de Tesis
============================================================
Genera 50 registros de evaluación usando 2 estrategias:

  OPCIÓN A: Multi-pregunta por alimento (30 registros)
    → Misma comida, 3 ángulos distintos:
      (1) calorías, (2) macronutrientes, (3) recomendación DM2
    → Demuestra consistencia del sistema RAG

  OPCIÓN B: Combinaciones alimentarias (10 registros)
    → Preguntas tipo dieta real: desayuno, almuerzo, cena
    → Eleva el nivel de evaluación a IA nutricional

  COMPLEMENTO: Alimentos adicionales (10 registros)
    → Cobertura de categorías: verduras, proteínas, lácteos

REQUISITO: El servicio RAG debe estar corriendo en localhost:8000
  cd ai-service && uvicorn main:app --reload

USO:
  cd scripts/evaluacion
  python generar_data.py
============================================================
"""

import requests
import pandas as pd
import re
import time
import os

API_URL    = "http://localhost:8000/api/recommend"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "data", "data.xlsx")

# ═══════════════════════════════════════════════════════════
# BLOQUE A — Multi-pregunta por alimento (10 × 3 = 30 casos)
# Fuente: TPCA CENAN/INS 2025
# ═══════════════════════════════════════════════════════════
CASOS_PRUEBA = [

    # ── QUINUA (3 preguntas) ─────────────────────────────────
    {
        "alimento": "Quinua (calorías)",
        "pregunta": "¿Cuántas calorías tiene la quinua por 100 gramos según la TPCA del CENAN?",
        "kcal_real": 351.0,
        "texto_ref": (
            "La quinua contiene 351 kcal por 100g según la TPCA CENAN/INS 2025. "
            "Aporta 13.6g de proteínas, 5.8g de grasas y 66.6g de carbohidratos disponibles. "
            "Tiene 5.9g de fibra dietaria. Es un alimento de alto valor nutricional."
        ),
    },
    {
        "alimento": "Quinua (macronutrientes)",
        "pregunta": "Dame el perfil completo de macronutrientes de la quinua: proteínas, grasas y carbohidratos.",
        "kcal_real": 351.0,
        "texto_ref": (
            "La quinua por 100g aporta 351 kcal, 13.6g de proteínas de alto valor biológico, "
            "5.8g de grasas totales y 66.6g de carbohidratos según la TPCA CENAN/INS. "
            "Contiene los 9 aminoácidos esenciales. Su fibra dietaria de 5.9g favorece el control glucémico."
        ),
    },
    {
        "alimento": "Quinua (DM2)",
        "pregunta": "¿Cuántas calorías tiene la quinua y por qué es recomendada para pacientes con diabetes tipo 2?",
        "kcal_real": 351.0,
        "texto_ref": (
            "La quinua contiene 351 kcal por 100g según la TPCA. Su índice glucémico es 53, moderado-bajo. "
            "Es RECOMENDADA para DM2 porque su alta proteína (13.6g) y fibra (5.9g) reducen el pico glucémico "
            "postprandial. Sustituye al arroz blanco (IG 73) como fuente de carbohidratos."
        ),
    },

    # ── TARWI / CHOCHO (3 preguntas) ─────────────────────────
    {
        "alimento": "Tarwi (calorías)",
        "pregunta": "¿Cuántas calorías tiene el tarwi o chocho crudo por 100 gramos?",
        "kcal_real": 399.0,
        "texto_ref": (
            "El tarwi o chocho crudo contiene 399 kcal por 100g según la TPCA CENAN/INS 2025. "
            "Es el alimento andino con mayor contenido proteico: 47.0g de proteínas por 100g. "
            "Aporta 21.3g de grasas y solo 16.5g de carbohidratos."
        ),
    },
    {
        "alimento": "Tarwi (proteínas)",
        "pregunta": "¿Cuántas proteínas y calorías tiene el tarwi? ¿Es bueno como fuente proteica para diabéticos?",
        "kcal_real": 399.0,
        "texto_ref": (
            "El tarwi contiene 399 kcal y 47.0g de proteínas por 100g, siendo la leguminosa andina "
            "más proteica según la TPCA. Su índice glucémico es 16, muy bajo. "
            "Es altamente RECOMENDADO para DM2 por su bajo impacto glucémico y alto aporte proteico."
        ),
    },
    {
        "alimento": "Tarwi cocido (DM2)",
        "pregunta": "¿Cuántas calorías tiene el tarwi ya cocido y desamargado? ¿Puede comerlo un diabético?",
        "kcal_real": 115.0,
        "texto_ref": (
            "El tarwi cocido y desamargado contiene 115 kcal por 100g según la TPCA. "
            "Aporta 15.6g de proteínas, 7.1g de grasas y 9.1g de carbohidratos. "
            "Su índice glucémico es 16, muy bajo. RECOMENDADO ampliamente para pacientes con DM2."
        ),
    },

    # ── CEBADA (3 preguntas) ─────────────────────────────────
    {
        "alimento": "Cebada (calorías)",
        "pregunta": "¿Cuántas calorías tiene la cebada con cáscara por 100 gramos según la TPCA?",
        "kcal_real": 284.0,
        "texto_ref": (
            "La cebada con cáscara contiene 284 kcal por 100g según la TPCA CENAN/INS. "
            "Aporta 8.4g de proteínas, 2.0g de grasas y 77.5g de carbohidratos. "
            "Tiene 17.3g de fibra dietaria, la más alta entre los cereales evaluados."
        ),
    },
    {
        "alimento": "Cebada (fibra-IG)",
        "pregunta": "¿Cuánta fibra y calorías tiene la cebada? ¿Cuál es su índice glucémico?",
        "kcal_real": 284.0,
        "texto_ref": (
            "La cebada contiene 284 kcal y 17.3g de fibra por 100g según la TPCA. "
            "Su índice glucémico es 28, muy bajo. La alta fibra beta-glucano "
            "reduce el pico glucémico postprandial hasta un 30%. RECOMENDADO para DM2."
        ),
    },
    {
        "alimento": "Cebada (vs arroz)",
        "pregunta": "¿Cuántas calorías tiene la cebada comparada con el arroz? ¿Cuál es mejor para un diabético?",
        "kcal_real": 284.0,
        "texto_ref": (
            "La cebada tiene 284 kcal/100g con IG 28, mientras el arroz pilado tiene 115 kcal cocido con IG 73. "
            "La cebada es SUPERIOR para DM2 por su menor índice glucémico y mayor fibra (17.3g vs 0.3g). "
            "Sustituir arroz por cebada reduce el pico glucémico postprandial significativamente."
        ),
    },

    # ── AVENA (3 preguntas) ──────────────────────────────────
    {
        "alimento": "Avena hojuela (calorías)",
        "pregunta": "¿Cuántas calorías tiene la avena en hojuela cruda por 100 gramos?",
        "kcal_real": 333.0,
        "texto_ref": (
            "La avena en hojuela cruda contiene 333 kcal por 100g según la TPCA CENAN/INS. "
            "Aporta 13.3g de proteínas, 4.0g de grasas y 72.2g de carbohidratos. "
            "Tiene 10.6g de fibra dietaria (beta-glucano)."
        ),
    },
    {
        "alimento": "Avena (fibra beta-glucano)",
        "pregunta": "¿Cuántas calorías y fibra tiene la avena? ¿Qué beneficio tiene para diabéticos?",
        "kcal_real": 333.0,
        "texto_ref": (
            "La avena contiene 333 kcal y 10.6g de fibra beta-glucano por 100g según la TPCA. "
            "El beta-glucano forma un gel viscoso en el intestino que retarda la absorción de glucosa. "
            "RECOMENDADO para DM2 con IG 55. Reduce la hemoglobina glicosilada HbA1c."
        ),
    },
    {
        "alimento": "Avena envasada (desayuno)",
        "pregunta": "¿Cuántas calorías tiene la avena envasada? ¿Es una buena opción de desayuno para un diabético?",
        "kcal_real": 380.0,
        "texto_ref": (
            "La avena envasada contiene 380 kcal por 100g según la TPCA. "
            "Aporta 13.7g de proteínas, 4.7g de grasas y 71.3g de carbohidratos. "
            "IG 55, RECOMENDADO para desayuno DM2. Combinar con tarwi o kiwicha mejora el perfil proteico."
        ),
    },

    # ── LENTEJA (3 preguntas) ────────────────────────────────
    {
        "alimento": "Lenteja cruda (calorías)",
        "pregunta": "¿Cuántas calorías tiene la lenteja cruda por 100 gramos según la TPCA?",
        "kcal_real": 353.0,
        "texto_ref": (
            "La lenteja cruda contiene 353 kcal por 100g según la TPCA CENAN/INS. "
            "Aporta 25.8g de proteínas, 1.8g de grasas y 60.1g de carbohidratos. "
            "Tiene 11.4g de fibra dietaria. IG 29, muy bajo."
        ),
    },
    {
        "alimento": "Lenteja cocida (DM2)",
        "pregunta": "¿Cuántas calorías tiene la lenteja cocida? ¿Con qué frecuencia la puede comer un diabético?",
        "kcal_real": 114.0,
        "texto_ref": (
            "La lenteja cocida contiene 114 kcal por 100g según la TPCA. "
            "Aporta 8.4g de proteínas, 0.6g de grasas y 19.5g de carbohidratos. "
            "IG 29, muy bajo. RECOMENDADO 3-4 veces por semana para DM2. "
            "Excelente fuente de proteína vegetal y hierro."
        ),
    },
    {
        "alimento": "Lenteja (hierro proteína)",
        "pregunta": "¿Cuántas calorías y proteínas tiene la lenteja? ¿Es una buena fuente de hierro para diabéticos?",
        "kcal_real": 353.0,
        "texto_ref": (
            "La lenteja cruda aporta 353 kcal y 25.8g de proteínas por 100g según la TPCA. "
            "Contiene 7.6mg de hierro y 11.4g de fibra. Su IG de 29 la hace ideal para DM2. "
            "RECOMENDADO como sustituto de la carne roja en la dieta del diabético."
        ),
    },

    # ── CAMOTE (3 preguntas) ─────────────────────────────────
    {
        "alimento": "Camote amarillo (calorías)",
        "pregunta": "¿Cuántas calorías tiene el camote amarillo crudo por 100 gramos?",
        "kcal_real": 105.0,
        "texto_ref": (
            "El camote amarillo crudo contiene 105 kcal por 100g según la TPCA CENAN/INS. "
            "Aporta 1.6g de proteínas, 0.3g de grasas y 24.3g de carbohidratos. "
            "Tiene 3.0g de fibra dietaria."
        ),
    },
    {
        "alimento": "Camote (vs papa)",
        "pregunta": "¿Cuántas calorías tiene el camote? ¿Es mejor que la papa para un paciente con diabetes tipo 2?",
        "kcal_real": 105.0,
        "texto_ref": (
            "El camote tiene 105 kcal/100g con IG 54, mejor que la papa blanca (97 kcal, IG 70). "
            "El camote es RECOMENDADO para DM2 por su menor IG y mayor contenido de betacarotenos. "
            "La papa blanca es LIMITAR por su alto IG que eleva la glucosa rápidamente."
        ),
    },
    {
        "alimento": "Camote (betacarotenos)",
        "pregunta": "¿Cuántas calorías tiene el camote y qué micronutrientes aporta para diabéticos?",
        "kcal_real": 105.0,
        "texto_ref": (
            "El camote amarillo contiene 105 kcal y es rico en betacarotenos (vitamina A precursora) "
            "según la TPCA. Aporta 3.0g de fibra. Su IG de 54 es moderado. "
            "RECOMENDADO para DM2 en porciones de 100-150g. Los betacarotenos tienen acción antioxidante."
        ),
    },

    # ── AGUAYMANTO (3 preguntas) ─────────────────────────────
    {
        "alimento": "Aguaymanto (calorías)",
        "pregunta": "¿Cuántas calorías tiene el aguaymanto por 100 gramos según la TPCA?",
        "kcal_real": 53.0,
        "texto_ref": (
            "El aguaymanto contiene 53 kcal por 100g según la TPCA CENAN/INS 2025. "
            "Aporta 1.9g de proteínas, 0.7g de grasas y 11.2g de carbohidratos. "
            "Tiene 2.0g de fibra y alto contenido de vitamina C y withanólidos."
        ),
    },
    {
        "alimento": "Aguaymanto (antioxidante)",
        "pregunta": "¿Cuántas calorías tiene el aguaymanto y qué propiedades antioxidantes tiene para diabéticos?",
        "kcal_real": 53.0,
        "texto_ref": (
            "El aguaymanto contiene 53 kcal por 100g. Sus withanólidos tienen efecto hipoglucemiante "
            "demostrado en estudios. IG 25, muy bajo. Aporta vitamina C y antioxidantes. "
            "RECOMENDADO para DM2 como fruta de consumo regular para control de la glucosa."
        ),
    },
    {
        "alimento": "Aguaymanto (fruta andina)",
        "pregunta": "¿Cuántas calorías y vitamina C tiene el aguaymanto? ¿Es mejor que otras frutas para diabéticos?",
        "kcal_real": 53.0,
        "texto_ref": (
            "El aguaymanto aporta 53 kcal y alto contenido de vitamina C según la TPCA. "
            "Con IG 25 es mejor opción que el mango (IG 51) o la chirimoya (IG 35) para DM2. "
            "RECOMENDADO como la fruta andina más adecuada para control glucémico en DM2."
        ),
    },

    # ── PALTA / AGUACATE (3 preguntas) ───────────────────────
    {
        "alimento": "Palta (calorías)",
        "pregunta": "¿Cuántas calorías tiene la palta o aguacate por 100 gramos según la TPCA?",
        "kcal_real": 177.0,
        "texto_ref": (
            "La palta o aguacate contiene 177 kcal por 100g según la TPCA CENAN/INS. "
            "Aporta 2.0g de proteínas, 17.0g de grasas (principalmente monoinsaturadas) y 6.3g de carbohidratos. "
            "Tiene 6.7g de fibra dietaria. IG 15, muy bajo."
        ),
    },
    {
        "alimento": "Palta (grasas saludables)",
        "pregunta": "¿Cuántas calorías y grasas tiene la palta? ¿Son buenas esas grasas para un diabético?",
        "kcal_real": 177.0,
        "texto_ref": (
            "La palta tiene 177 kcal y 17.0g de grasas monoinsaturadas (ácido oleico) por 100g según la TPCA. "
            "Las grasas monoinsaturadas mejoran la sensibilidad a la insulina y reducen el colesterol LDL. "
            "IG 15. RECOMENDADO para DM2 en porciones de 1/4 a 1/2 palta diaria."
        ),
    },
    {
        "alimento": "Palta (insulina)",
        "pregunta": "¿Puede comer palta un paciente con diabetes tipo 2? ¿Cuántas calorías tiene?",
        "kcal_real": 177.0,
        "texto_ref": (
            "Sí, la palta es RECOMENDADA para DM2. Contiene 177 kcal con IG 15, muy bajo. "
            "Sus grasas monoinsaturadas (17g/100g) y fibra (6.7g) no elevan la glucosa. "
            "Mejoran la sensibilidad a la insulina. Consumo recomendado: 1/4 palta (50g) por porción."
        ),
    },

    # ── CAÑIHUA (3 preguntas) ────────────────────────────────
    {
        "alimento": "Cañihua amarilla (calorías)",
        "pregunta": "¿Cuántas calorías tiene la cañihua amarilla por 100 gramos?",
        "kcal_real": 381.0,
        "texto_ref": (
            "La cañihua variedad amarilla contiene 381 kcal por 100g según la TPCA CENAN/INS. "
            "Aporta 15.7g de proteínas, 7.5g de grasas y 62.5g de carbohidratos. "
            "IG 45, bajo. RECOMENDADO para pacientes con diabetes tipo 2."
        ),
    },
    {
        "alimento": "Cañihua (hierro calcio)",
        "pregunta": "¿Cuántas calorías y minerales tiene la cañihua? ¿Es mejor que la quinua para diabéticos?",
        "kcal_real": 381.0,
        "texto_ref": (
            "La cañihua contiene 381 kcal por 100g, con 15.7g proteínas (mayor que quinua 13.6g). "
            "Rica en hierro y calcio según la TPCA. IG 45, menor que quinua (IG 53). "
            "RECOMENDADO para DM2. Es el grano andino menos conocido pero con mayor densidad nutricional."
        ),
    },
    {
        "alimento": "Cañihua parda (calorías)",
        "pregunta": "¿Cuántas calorías tiene la cañihua parda? ¿Sirve para controlar la glucosa?",
        "kcal_real": 355.0,
        "texto_ref": (
            "La cañihua parda contiene 355 kcal por 100g según la TPCA CENAN/INS. "
            "Aporta 13.8g de proteínas, 3.5g de grasas y 66.2g de carbohidratos. "
            "IG 45. RECOMENDADO para control glucémico en DM2 por su bajo índice glucémico."
        ),
    },

    # ── KIWICHA / AMARANTO (3 preguntas) ─────────────────────
    {
        "alimento": "Kiwicha (calorías)",
        "pregunta": "¿Cuántas calorías tiene la kiwicha o amaranto por 100 gramos según la TPCA?",
        "kcal_real": 351.0,
        "texto_ref": (
            "La kiwicha o amaranto contiene 351 kcal por 100g según la TPCA CENAN/INS 2025. "
            "Aporta 12.8g de proteínas, 6.6g de grasas y 69.1g de carbohidratos. "
            "Tiene 9.3g de fibra dietaria. IG 35, bajo."
        ),
    },
    {
        "alimento": "Kiwicha (IG bajo)",
        "pregunta": "¿Cuántas calorías tiene la kiwicha y cuál es su índice glucémico? ¿Es mejor que la quinua para DM2?",
        "kcal_real": 351.0,
        "texto_ref": (
            "La kiwicha tiene 351 kcal/100g con IG 35, menor que la quinua (IG 53). "
            "Ambas tienen similar contenido calórico pero la kiwicha tiene mayor fibra (9.3g vs 5.9g). "
            "RECOMENDADO para DM2. El menor IG de la kiwicha produce menor pico glucémico postprandial."
        ),
    },
    {
        "alimento": "Kiwicha pop (snack)",
        "pregunta": "¿Cuántas calorías tiene la kiwicha reventada o pop? ¿Es un buen snack para diabéticos?",
        "kcal_real": 351.0,
        "texto_ref": (
            "La kiwicha pop o reventada mantiene un perfil calórico similar (~351 kcal/100g) según la TPCA. "
            "Al no agregar azúcar es RECOMENDADO como snack para DM2. "
            "Aportar fibra y proteínas que reducen el hambre entre comidas. Porción: 30g."
        ),
    },

    # ═══════════════════════════════════════════════════════════
    # BLOQUE B — Combinaciones alimentarias tipo dieta (10 casos)
    # kcal_real = alimento principal de referencia
    # ═══════════════════════════════════════════════════════════

    {
        "alimento": "Desayuno quinua + leche",
        "pregunta": "¿Puedes sugerirme un desayuno con quinua para un paciente con diabetes tipo 2? ¿Cuántas calorías tiene la quinua?",
        "kcal_real": 351.0,
        "texto_ref": (
            "Desayuno RECOMENDADO para DM2: Quinua (351 kcal/100g, IG 53) con leche fresca (62 kcal/100g, IG 27). "
            "Combinar 50g de quinua cocida (89 kcal) + 200ml leche = ~200 kcal totales. "
            "Esta combinación aporta proteínas completas y calcio sin elevar la glucosa bruscamente."
        ),
    },
    {
        "alimento": "Desayuno avena + aguaymanto",
        "pregunta": "¿Qué desayuno con avena es recomendado para un diabético? ¿Cuántas calorías tiene la avena?",
        "kcal_real": 333.0,
        "texto_ref": (
            "Desayuno RECOMENDADO para DM2: Avena hojuela (333 kcal/100g, IG 55) + aguaymanto (53 kcal, IG 25). "
            "Preparar 40g de avena cocida (~130 kcal) + 100g aguaymanto (53 kcal) = ~183 kcal totales. "
            "El beta-glucano de la avena ralentiza la absorción de glucosa; el aguaymanto aporta vitamina C y antioxidantes."
        ),
    },
    {
        "alimento": "Almuerzo cebada + verduras",
        "pregunta": "¿Qué almuerzo con cebada es adecuado para diabetes? ¿Cuántas calorías tiene la cebada?",
        "kcal_real": 284.0,
        "texto_ref": (
            "Almuerzo RECOMENDADO para DM2: Cebada perlada (284 kcal cruda, IG 28) + brócoli (34 kcal) + zanahoria (44 kcal). "
            "50g cebada cocida (~30 kcal) + 100g brócoli + 50g zanahoria = ~100 kcal del plato base. "
            "La cebada con fibra 17.3g es el cereal más favorable para DM2 por su IG 28 ultra bajo."
        ),
    },
    {
        "alimento": "Almuerzo tarwi + ensalada",
        "pregunta": "¿Puedes recomendarme un almuerzo con tarwi para un paciente con diabetes? ¿Cuántas calorías tiene?",
        "kcal_real": 115.0,
        "texto_ref": (
            "Almuerzo RECOMENDADO para DM2: Tarwi cocido (115 kcal/100g, IG 16) + ensalada de tomate (20 kcal) + palta (177 kcal). "
            "100g tarwi + 100g tomate + 50g palta = ~225 kcal totales. "
            "El tarwi aporta 15.6g proteínas; la palta grasas monoinsaturadas que mejoran sensibilidad a insulina."
        ),
    },
    {
        "alimento": "Merienda aguaymanto + cañihua",
        "pregunta": "¿Qué merienda saludable puedo recomendar con aguaymanto para un diabético? ¿Cuántas calorías tiene?",
        "kcal_real": 53.0,
        "texto_ref": (
            "Merienda RECOMENDADO para DM2: Aguaymanto fresco (53 kcal/100g, IG 25) + cañihua pop (381 kcal cruda). "
            "100g aguaymanto + 20g cañihua pop = ~130 kcal. "
            "Esta combinación andina aporta vitamina C, hierro y proteínas vegetales con bajo impacto glucémico."
        ),
    },
    {
        "alimento": "Cena jurel + brócoli",
        "pregunta": "¿Cuántas calorías tiene el jurel a la plancha? ¿Es una buena cena para diabéticos?",
        "kcal_real": 124.0,
        "texto_ref": (
            "Cena RECOMENDADA para DM2: Jurel fresco (124 kcal/100g, IG 0) + brócoli al vapor (34 kcal). "
            "150g jurel + 150g brócoli = ~230 kcal totales. "
            "El omega-3 del jurel mejora sensibilidad a insulina; el brócoli aporta fibra y vitamina C sin elevar glucosa."
        ),
    },
    {
        "alimento": "Colación palta + tomate",
        "pregunta": "¿Qué colación con palta es recomendada para un paciente con diabetes tipo 2? ¿Cuántas calorías tiene la palta?",
        "kcal_real": 177.0,
        "texto_ref": (
            "Colación RECOMENDADA para DM2: Palta (177 kcal/100g, IG 15) con tomate cherry (20 kcal). "
            "50g palta (~90 kcal) + 100g tomate (20 kcal) = ~110 kcal. "
            "La palta aporta grasas monoinsaturadas que mejoran perfil lipídico; el tomate licopenos antioxidantes."
        ),
    },
    {
        "alimento": "Bebida camu camu + maracuyá",
        "pregunta": "¿Cuántas calorías tiene el camu camu? ¿Es una bebida recomendada para diabéticos?",
        "kcal_real": 17.0,
        "texto_ref": (
            "Bebida RECOMENDADA para DM2: Camu camu (17 kcal/100g, IG muy bajo) + maracuyá (67 kcal, IG 30). "
            "Esta combinación aporta vitamina C excepcional (>2000mg desde el camu camu) y fibra del maracuyá. "
            "Sin azúcar agregada. Total: ~30 kcal por vaso. Ideal para control glucémico."
        ),
    },
    {
        "alimento": "Postre lúcuma natural",
        "pregunta": "¿Cuántas calorías tiene la lúcuma fresca? ¿Puede ser un postre para diabéticos?",
        "kcal_real": 99.0,
        "texto_ref": (
            "La lúcuma fresca contiene 99 kcal por 100g según la TPCA. IG 25, bajo. "
            "RECOMENDADO como postre natural para DM2 en porciones de 100g. "
            "Aporta 2.3g de fibra y niacina. Sustituto natural del azúcar en preparaciones."
        ),
    },
    {
        "alimento": "Menú superalimentos andinos",
        "pregunta": "¿Cuántas calorías tienen los superalimentos andinos como quinua, tarwi y kiwicha? ¿Cuál recomiendas más para DM2?",
        "kcal_real": 399.0,
        "texto_ref": (
            "Superalimentos andinos para DM2 según la TPCA: "
            "Tarwi (399 kcal, IG 16) es el mejor para DM2 por su mínimo impacto glucémico y 47g proteínas. "
            "Quinua (351 kcal, IG 53) y kiwicha (351 kcal, IG 35) son también RECOMENDADOS. "
            "La cañihua (381 kcal, IG 45) es la menos conocida pero muy nutritiva."
        ),
    },

    # ═══════════════════════════════════════════════════════════
    # BLOQUE C — Alimentos complementarios (10 casos)
    # ═══════════════════════════════════════════════════════════

    {
        "alimento": "Brócoli crudo",
        "pregunta": "¿Cuántas calorías tiene el brócoli crudo? ¿Es libre consumo para diabéticos?",
        "kcal_real": 34.0,
        "texto_ref": (
            "El brócoli crudo contiene 34 kcal por 100g según la TPCA. IG 10, muy bajo. "
            "Aporta 3.6g de proteínas, 2.6g de fibra y vitamina C. "
            "RECOMENDADO de consumo libre para DM2. Sin restricción de cantidad."
        ),
    },
    {
        "alimento": "Espinaca cruda",
        "pregunta": "¿Cuántas calorías tiene la espinaca cruda? ¿Cuánto puede comer un diabético?",
        "kcal_real": 26.0,
        "texto_ref": (
            "La espinaca cruda contiene 26 kcal por 100g según la TPCA. IG 15, muy bajo. "
            "Aporta 2.9g de proteínas, 2.2g de fibra y hierro. "
            "RECOMENDADO de consumo libre para DM2. Consumo ilimitado recomendado."
        ),
    },
    {
        "alimento": "Zanahoria cruda",
        "pregunta": "¿Cuántas calorías tiene la zanahoria cruda? ¿La puede comer libremente un diabético?",
        "kcal_real": 44.0,
        "texto_ref": (
            "La zanahoria cruda contiene 44 kcal por 100g según la TPCA. IG cruda 16, muy bajo. "
            "Aporta 1.1g de proteínas, 3.2g de fibra y betacarotenos. "
            "RECOMENDADO para DM2 cruda. Nota: cocida el IG sube a 47."
        ),
    },
    {
        "alimento": "Jurel fresco",
        "pregunta": "¿Cuántas calorías tiene el jurel fresco por 100 gramos? ¿Es bueno para diabéticos?",
        "kcal_real": 124.0,
        "texto_ref": (
            "El jurel fresco contiene 124 kcal por 100g según la TPCA. IG 0. "
            "Aporta 20.2g de proteínas y 4.7g de grasas omega-3. "
            "RECOMENDADO para DM2. El omega-3 reduce inflamación y mejora la sensibilidad a la insulina."
        ),
    },
    {
        "alimento": "Pechuga pollo sin piel",
        "pregunta": "¿Cuántas calorías tiene la pechuga de pollo sin piel? ¿Es apta para la dieta del diabético?",
        "kcal_real": 121.0,
        "texto_ref": (
            "La pechuga de pollo sin piel contiene 121 kcal por 100g según la TPCA. IG 0. "
            "Aporta 22.5g de proteínas y solo 2.8g de grasas. "
            "RECOMENDADO para DM2 como proteína magra. No eleva la glucosa."
        ),
    },
    {
        "alimento": "Huevo de gallina crudo",
        "pregunta": "¿Cuántas calorías tiene el huevo de gallina crudo? ¿Cuántos puede comer un diabético por día?",
        "kcal_real": 155.0,
        "texto_ref": (
            "El huevo de gallina crudo contiene 155 kcal por 100g (aprox. 1 huevo grande = 60g = 93 kcal) según la TPCA. "
            "Aporta 12.6g de proteínas, 11.5g de grasas y 0.7g de carbohidratos. IG 0. "
            "RECOMENDADO hasta 1 huevo diario para DM2. Proteína de alto valor biológico."
        ),
    },
    {
        "alimento": "Frijol canario crudo",
        "pregunta": "¿Cuántas calorías tiene el frijol canario crudo? ¿Es bueno para diabéticos?",
        "kcal_real": 347.0,
        "texto_ref": (
            "El frijol canario crudo contiene 347 kcal por 100g según la TPCA. IG 31, bajo. "
            "Aporta 22.6g de proteínas, 1.5g de grasas y 66.4g de carbohidratos. "
            "Tiene 15.2g de fibra. RECOMENDADO para DM2. Consumir cocido 3 veces/semana."
        ),
    },
    {
        "alimento": "Maíz choclo fresco",
        "pregunta": "¿Cuántas calorías tiene el choclo o maíz fresco? ¿Lo puede comer un diabético?",
        "kcal_real": 104.0,
        "texto_ref": (
            "El maíz fresco o choclo contiene 104 kcal por 100g según la TPCA. IG 52, moderado. "
            "Aporta 3.3g de proteínas, 0.8g de grasas y 27.8g de carbohidratos. "
            "RECOMENDADO en porciones controladas para DM2. Máximo 1 choclo mediano (150g) por comida."
        ),
    },
    {
        "alimento": "Arroz pilado cocido",
        "pregunta": "¿Cuántas calorías tiene el arroz pilado cocido? ¿Lo puede comer un paciente con diabetes tipo 2?",
        "kcal_real": 115.0,
        "texto_ref": (
            "El arroz pilado cocido contiene 115 kcal por 100g según la TPCA. IG 73, alto. "
            "Aporta 2.4g de proteínas, 0.1g de grasas y 25.2g de carbohidratos. "
            "LIMITAR para DM2 por su IG alto. Preferir quinua (IG 53) o cebada (IG 28) como alternativa."
        ),
    },
    {
        "alimento": "Leche fresca de vaca",
        "pregunta": "¿Cuántas calorías tiene la leche fresca de vaca entera? ¿Puede beberla un diabético?",
        "kcal_real": 62.0,
        "texto_ref": (
            "La leche fresca de vaca entera contiene 62 kcal por 100g según la TPCA. IG 27, bajo. "
            "Aporta 3.2g de proteínas, 3.5g de grasas y 4.7g de carbohidratos (lactosa). "
            "RECOMENDADO para DM2 en porción de 1 vaso (200ml = ~125 kcal) por día."
        ),
    },
]

assert len(CASOS_PRUEBA) == 50, f"Se esperaban 50 casos, hay {len(CASOS_PRUEBA)}"


def extraer_kcal(texto: str) -> float:
    """Extrae el primer valor calórico (kcal) del texto de respuesta RAG."""
    patrones = [
        r'(\d{2,4}(?:\.\d+)?)\s*kcal',
        r'(\d{2,4}(?:\.\d+)?)\s*kilocalorías',
        r'[Cc]alorías[:\s]+(\d{2,4}(?:\.\d+)?)',
        r'[Ee]nergía[:\s]+(\d{2,4}(?:\.\d+)?)',
    ]
    for patron in patrones:
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            return float(match.group(1))
    return float("nan")


def llamar_rag(pregunta: str) -> dict:
    """Llama al endpoint /api/recommend del servicio RAG."""
    payload = {
        "mensaje": pregunta,
        "perfil_salud": {
            "clasificacion_dm2": "DM2_SIN_COMPLICACIONES",
            "carbohidratos_max": 45.0,
        },
        "historial": [],
    }
    respuesta = requests.post(API_URL, json=payload, timeout=60)
    respuesta.raise_for_status()
    return respuesta.json()


def main():
    print("=" * 65)
    print("  GENERADOR DE DATA - EVALUACIÓN RAG NutriDiabetes Perú")
    print("=" * 65)
    print(f"  Endpoint:        {API_URL}")
    print(f"  Total de casos:  {len(CASOS_PRUEBA)}")
    print("  ├── Bloque A: Multi-pregunta por alimento  (30 casos)")
    print("  ├── Bloque B: Combinaciones tipo dieta     (10 casos)")
    print("  └── Bloque C: Alimentos complementarios    (10 casos)")
    print("=" * 65)

    try:
        ping = requests.get("http://localhost:8000/health", timeout=5)
        estado = ping.json()
        print(f"  Servicio RAG: {estado.get('status', 'desconocido').upper()}")
        print(f"  Pinecone:     {estado.get('pinecone', 'desconocido').upper()}")
        print(f"  OpenAI:       {estado.get('openai', 'desconocido').upper()}")
    except Exception:
        print("\n  ERROR: El servicio RAG no está disponible en localhost:8000")
        print("  Inicia: uvicorn main:app --reload  (desde ai-service/)")
        return

    print()

    filas = []
    for i, caso in enumerate(CASOS_PRUEBA, 1):
        print(f"[{i:02d}/{len(CASOS_PRUEBA)}] {caso['alimento']:<34}...", end=" ", flush=True)
        try:
            resultado   = llamar_rag(caso["pregunta"])
            texto_rag   = resultado.get("respuesta", "")
            kcal_rag    = extraer_kcal(texto_rag)
            print(f"kcal: {kcal_rag:>6.1f}  (real: {caso['kcal_real']:>6.1f})")
            filas.append({
                "alimento":           caso["alimento"],
                "pregunta":           caso["pregunta"],
                "kcal_real":          caso["kcal_real"],
                "kcal_rag":           kcal_rag,
                "texto_ref":          caso["texto_ref"],
                "texto_rag":          texto_rag,
                "score_similitud":    resultado.get("score_similitud"),
                "chunks_recuperados": resultado.get("chunks_recuperados"),
                "tokens_entrada":     resultado.get("tokens_entrada"),
                "tokens_salida":      resultado.get("tokens_salida"),
                "tiempo_ms":          resultado.get("tiempo_ms"),
            })
            time.sleep(1)
        except Exception as e:
            print(f"ERROR: {e}")
            filas.append({
                "alimento":           caso["alimento"],
                "pregunta":           caso["pregunta"],
                "kcal_real":          caso["kcal_real"],
                "kcal_rag":           float("nan"),
                "texto_ref":          caso["texto_ref"],
                "texto_rag":          f"ERROR: {e}",
                "score_similitud":    None,
                "chunks_recuperados": None,
                "tokens_entrada":     None,
                "tokens_salida":      None,
                "tiempo_ms":          None,
            })

    df = pd.DataFrame(filas)
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    df.to_excel(OUTPUT_PATH, index=False)

    exitosos = df["kcal_rag"].notna().sum()
    print()
    print("=" * 65)
    print(f"  Casos completados: {exitosos}/{len(CASOS_PRUEBA)}")
    print(f"  Archivo guardado:  {OUTPUT_PATH}")
    print()
    print("  Siguiente paso:")
    print("    python mape_precision.py   → MAPE + estadísticas + gráfico")
    print("    python coseno_coherencia.py → coherencia semántica")
    print("=" * 65)


if __name__ == "__main__":
    main()
