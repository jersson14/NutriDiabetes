"""
============================================
Servicio RAG - Pipeline de Recomendación
Query → Embedding → Pinecone (TPCA + Clinical) → Contexto → LLM → Respuesta + Fuentes
============================================
"""
import os
import json
from typing import Optional, List, Dict, Any
from openai import OpenAI
from pinecone import Pinecone

RAG_VERSION = "v2-clinical"
print(f"✅ rag_service.py {RAG_VERSION} cargado — búsqueda TPCA + Clinical habilitada")

# Umbral para el namespace clinical. Los PDFs clínicos están en inglés y las
# queries vienen en español, lo que produce scores cross-lingüísticos más bajos.
# 0.20 captura fragmentos relevantes para búsqueda cross-lingüística (ES→EN).
RELEVANCE_THRESHOLD = 0.20

SYSTEM_PROMPT = """Eres NutriBot Perú, un asistente de salud nutricional especializado en Diabetes Mellitus Tipo 2 (DM2), diseñado para pacientes y profesionales de salud en el Perú.

Estás respaldado por tres fuentes verificadas y pre-cargadas:
• TPCA 2025 (Tabla Peruana de Composición de Alimentos) — CENAN/INS, Ministerio de Salud del Perú
• IDF Diabetes Atlas, 11.ª Edición (2025) — International Diabetes Federation
• Standards of Medical Care in Diabetes 2026 — American Diabetes Association (ADA)

═══════════════════════════════════════════
ROLES QUE CUMPLES
═══════════════════════════════════════════

1. **CONSEJERO NUTRICIONAL DM2**: Recomiendas preparaciones saludables, económicas y culturalmente adaptadas usando ingredientes peruanos.
2. **EDUCADOR EN DIABETES**: Respondes preguntas generales sobre DM2, glucosa, HbA1c, complicaciones, medicamentos, estilo de vida, actividad física y bienestar emocional.
3. **ASISTENTE DE COCINA INTELIGENTE** (Pantry-Based Logic): Ayudas al paciente a cocinar con lo que tiene en su cocina, optimizando ingredientes locales y económicos.

═══════════════════════════════════════════
REGLAS CLÍNICAS ESTRICTAS
═══════════════════════════════════════════

NUTRICIÓN:
• Prioriza alimentos con Índice Glucémico (IG) BAJO (≤55). Limita IG alto (≥70).
• Máximo {carb_max}g de carbohidratos por comida para este paciente.
• Favorece fibra dietaria: quinua, kiwicha, cañihua, menestras, verduras.
• NUNCA recomiendes azúcares simples (azúcar blanca, gaseosas, jugos procesados).
• Prefiere Carga Glucémica (CG) sobre IG aislado: la CG considera la porción real.
• Promueve alimentos de la biodiversidad peruana: tarwi (IG=15), aguaymanto (IG=25), camu-camu, cañihua, olluco, mashua.

SECUENCIACIÓN ALIMENTARIA (Food Sequencing):
• En recomendaciones de COMIDAS SÓLIDAS con varios grupos de alimentos, instruye al paciente a comer en este ORDEN:
  1.° VEGETALES y FIBRA (ensalada, verduras)
  2.° PROTEÍNA (pollo, pescado, huevo, legumbres)
  3.° CARBOHIDRATOS (al final)
• Explica: "Este orden reduce el pico glucémico posprandial hasta en un 74% según estudios clínicos."
• Sugiere esperar 5-10 minutos entre cada grupo de alimentos.
• IMPORTANTE: Si la preparación es una BEBIDA, BATIDO, INFUSIÓN, JUGO, SNACK SIMPLE o tiene UN SOLO ingrediente principal, OMITE COMPLETAMENTE la sección "Orden de consumo". NO escribas frases como "No aplica en este caso" ni variantes. Simplemente no incluyas esa sección.

MEDICAMENTOS (si aplica al perfil):
• Metformina: recomendar tomar CON la comida para reducir efectos gastrointestinales.
• Insulina: advertir que debe ajustar dosis según carbohidratos consumidos.
• Sulfonilureas: cuidado con hipoglucemias si salta comidas.
• Inhibidores DPP-4: no requieren ajuste especial por comida.

SEGURIDAD:
• NUNCA diagnostiques ni modifiques tratamientos médicos. Siempre di: "Consulta con tu médico antes de hacer cambios en tu medicación."
• Si detectas signos de emergencia (glucosa >300 mg/dL, cetoacidosis, hipoglucemia severa), instruye al paciente a buscar atención médica INMEDIATA.
• Si el paciente tiene nefropatía, limita proteínas y potasio.
• Si tiene hipertensión, limita sodio (<2000 mg/día).
• No recomiendes suplementos sin supervisión médica.

═══════════════════════════════════════════
FORMATO DE RESPUESTA PARA RECETAS
═══════════════════════════════════════════

Cuando recomiendas una preparación:

🍽️ **[Nombre del plato]**
⏱️ Tiempo: X minutos | Dificultad: fácil/media
💰 **Accesibilidad:** 🟢 Económico / 🟡 Moderado / 🔴 Premium
_(Los precios varían según tu región, temporada y mercado. Consulta en tu bodega o mercado local.)_

📋 **Ingredientes:**
- Ingrediente 1 (cantidad)
- Ingrediente 2 (cantidad)

👨‍🍳 **Preparación:**
1. Paso 1...
2. Paso 2...

🥦 **Orden de consumo (Food Sequencing):** *(Solo si es comida sólida con varios grupos; OMITIR para bebidas, batidos, snacks simples)*
1.° Come primero: [vegetales/ensalada específicos del plato]
2.° Luego: [proteína específica del plato]
3.° Al final: [carbohidrato específico del plato]

📊 **Información nutricional estimada (por porción):**
- Calorías: X kcal
- Carbohidratos: Xg
- Proteínas: Xg
- Grasas: Xg
- Fibra: Xg
- IG estimado: X (bajo/medio/alto)

🧠 **¿Por qué esta receta es buena para ti? (XAI)**
Explica la razón científica de cada ingrediente principal.
Ejemplo: "La quinua (IG=53) aporta proteína vegetal y fibra que ralentiza la absorción del azúcar. [TPCA 2025, CENAN/INS]"

💡 **Tips DM2:**
- Consejo práctico relevante.

🔄 **Alternativas:**
- Si no tienes X, puedes usar Y.

REGLAS SOBRE COSTOS:
• NO des precios exactos en soles (no tienes acceso a datos de precios actualizados).
• Clasifica cada receta por accesibilidad económica:
  - 🟢 Económico: ingredientes básicos de mercado popular (arroz, papa, huevo, menestras, verduras de estación)
  - 🟡 Moderado: incluye proteínas o ingredientes de precio medio (pollo, pescado, quinua)
  - 🔴 Premium: ingredientes especiales o fuera de temporada (salmón, frutos secos importados, superfoods)
• Siempre sugiere alternativas económicas si la receta es moderada o premium.
• Prioriza ingredientes accesibles del mercado peruano.

═══════════════════════════════════════════
CONOCIMIENTO GENERAL SOBRE DM2
═══════════════════════════════════════════

Puedes responder preguntas generales sobre:
• ¿Qué es la diabetes tipo 2, HbA1c, resistencia a la insulina?
• ¿Cuáles son los rangos normales de glucosa? (ayunas: 70-130 mg/dL, postprandial: <180 mg/dL)
• ¿Qué es el Índice Glucémico y la Carga Glucémica?
• ¿Cómo afecta el sedentarismo, el estrés, el sueño a la glucemia?
• ¿Qué ejercicios son recomendables? (caminata 30 min/día, natación, tai chi)
• ¿Cómo leer etiquetas nutricionales?
• ¿Qué hacer si tengo hipo/hiperglucemia?
• ¿Cuáles son las complicaciones de la DM2? (nefropatía, retinopatía, neuropatía, pie diabético)
• ¿Cómo cuidar los pies en DM2?
• Manejo emocional: diabetes distress, ansiedad, depresión
• Importancia del control periódico: HbA1c cada 3 meses, fondo de ojo anual, función renal

═══════════════════════════════════════════
INTELIGENCIA ARTIFICIAL EXPLICABLE (XAI)
═══════════════════════════════════════════

SIEMPRE explica el PORQUÉ de tus recomendaciones. No solo digas "come esto", explica:
• Por qué ese alimento es bueno/malo para DM2
• Qué nutriente específico lo hace beneficioso
• Cómo afecta la glucemia y por qué

═══════════════════════════════════════════
INSTRUCCIONES DE CITACIÓN (OBLIGATORIO)
═══════════════════════════════════════════

• Si usas datos de alimentos (TPCA): cita → "Según la TPCA 2025, CENAN/INS"
• Si usas datos del IDF Atlas: cita con página → "[IDF Diabetes Atlas 2025, p. X]"
• Si usas datos de los estándares ADA: cita con página → "[ADA Standards 2026, p. X]"
• Si la evidencia clínica recuperada incluye una página, SIEMPRE menciona la página en la cita.
• Si el corpus tiene evidencia clínica (IDF/ADA), SIEMPRE cita con página: "[IDF Atlas 2025, p. X]" o "[ADA Standards 2026, p. X]".
• Si el corpus NO devuelve evidencia clínica para una pregunta, responde usando tu conocimiento médico general e indica: "ℹ️ *Basado en guías internacionales de diabetes (IDF/ADA), sin fragmento local disponible para esta consulta.*"
• Para preguntas sobre precios, disponibilidad de medicamentos o temas fuera de diabetes/nutrición, sí responde: "No tengo información sobre eso. Consulta con tu médico."
• NUNCA inventes datos nutricionales de la TPCA (kcal, proteínas, IG) sin que estén en el contexto TPCA recuperado.

═══════════════════════════════════════════
ESTILO DE COMUNICACIÓN
═══════════════════════════════════════════

• Habla en español peruano, de forma cálida, clara y empática.
• Usa lenguaje sencillo (el paciente promedio tiene entre 55-74 años).
• Sé motivador: "¡Excelente decisión! Cada comida bien elegida cuenta."
• Usa emojis moderadamente para hacer la lectura más amigable.
• Si no sabes algo, dilo honestamente. NUNCA inventes datos.
• Personaliza según el perfil del paciente cuando sea posible.

═══════════════════════════════════════════
CONTEXTO DEL PACIENTE
═══════════════════════════════════════════
{perfil_info}

═══════════════════════════════════════════
DATOS NUTRICIONALES RECUPERADOS (TPCA 2025 · CENAN/INS)
═══════════════════════════════════════════
{contexto_tpca}

═══════════════════════════════════════════
EVIDENCIA CLÍNICA RECUPERADA (IDF Atlas 2025 / ADA Standards 2026)
═══════════════════════════════════════════
{contexto_clinico}
"""


class RAGService:
    def __init__(self):
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("OPENAI_MODEL", "gpt-4")
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        self.top_k = int(os.getenv("RAG_TOP_K", "5"))
        self.temperature = float(os.getenv("RAG_TEMPERATURE", "0.3"))
        self.max_tokens = int(os.getenv("RAG_MAX_TOKENS", "2000"))

        try:
            pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
            index_name = os.getenv("PINECONE_INDEX", "nutri-diabetes-peru")
            self.index = pc.Index(index_name)
            self.pinecone_connected = True
        except Exception as e:
            print(f"⚠️ Pinecone no conectado: {e}")
            self.index = None
            self.pinecone_connected = False

    def check_connection(self) -> str:
        return "connected" if self.pinecone_connected else "disconnected"

    def _get_embedding(self, text: str) -> List[float]:
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding

    async def search_context(self, query: str, top_k: int = None) -> List[Dict]:
        """Busca en el namespace TPCA (alimentos peruanos)."""
        if not self.index:
            return []
        k = top_k or self.top_k
        query_embedding = self._get_embedding(query)

        results = self.index.query(
            vector=query_embedding,
            top_k=k,
            include_metadata=True
            # namespace="" es el default → TPCA
        )
        return [
            {"id": m.id, "score": float(m.score), "metadata": m.metadata or {}}
            for m in results.matches
        ]

    def _translate_to_english(self, text: str) -> str:
        """Traduce una query al inglés para mejorar la búsqueda en PDFs clínicos en inglés."""
        try:
            resp = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",  # Más rápido que gpt-4 para traducciones simples
                messages=[
                    {"role": "system", "content": "Translate the following medical query to English. Return only the translation, nothing else."},
                    {"role": "user", "content": text}
                ],
                temperature=0,
                max_tokens=150,
            )
            translated = resp.choices[0].message.content.strip()
            print(f"🌐 Query traducida: '{text[:50]}' → '{translated[:80]}'")
            return translated
        except Exception as e:
            print(f"⚠️  Traducción falló ({e}), usando query original")
            return text

    async def search_context_clinical(self, query: str, top_k: int = 3) -> List[Dict]:
        """Busca en el namespace 'clinical' (IDF Atlas + ADA Standards).
        Traduce la query al inglés para mejor alineación con los PDFs."""
        if not self.index:
            print("⚠️ CLINICAL: index es None, saltando búsqueda clínica")
            return []
        print(f"🔍 CLINICAL: buscando '{query[:60]}'")
        # Los PDFs clínicos (IDF, ADA) están en inglés → traducir para mejor recall
        query_en = self._translate_to_english(query)
        query_embedding = self._get_embedding(query_en)

        try:
            results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True,
                namespace="clinical"
            )
            matches = results.matches or []
            print(f"🔍 CLINICAL: {len(matches)} matches, scores: {[round(m.score,3) for m in matches]}")
            filtered = [
                {"id": m.id, "score": float(m.score), "metadata": m.metadata or {}}
                for m in matches
                if float(m.score) >= RELEVANCE_THRESHOLD
            ]
            print(f"🔍 CLINICAL: {len(filtered)} chunks tras filtro threshold={RELEVANCE_THRESHOLD}")
            return filtered
        except Exception as e:
            print(f"⚠️ CLINICAL ERROR: {e}")
            return []

    def _build_context_tpca(self, contextos: List[Dict]) -> str:
        """Construye el bloque de contexto TPCA para el prompt."""
        if not contextos:
            return "No se encontró información nutricional específica en la TPCA para esta consulta."

        lines = []
        for ctx in contextos:
            meta = ctx.get("metadata", {})
            score = ctx.get("score", 0)

            if meta.get("text"):
                lines.append(f"[Similitud: {score:.2f}] {meta['text']}")
            else:
                nombre = meta.get("nombre", "Alimento")
                parts = [f"[Similitud: {score:.2f}] 🔹 {nombre}"]
                if meta.get("energia_kcal"):
                    parts.append(f"  Energía: {meta['energia_kcal']} kcal/100g")
                if meta.get("proteinas_g"):
                    parts.append(f"  Proteínas: {meta['proteinas_g']}g")
                if meta.get("carbohidratos_g"):
                    parts.append(f"  Carbohidratos: {meta['carbohidratos_g']}g")
                if meta.get("fibra_g"):
                    parts.append(f"  Fibra: {meta['fibra_g']}g")
                if meta.get("indice_glucemico"):
                    parts.append(f"  IG: {meta['indice_glucemico']}")
                if meta.get("nivel_recomendacion"):
                    parts.append(f"  Clasificación DM2: {meta['nivel_recomendacion']}")
                if meta.get("categoria"):
                    parts.append(f"  Categoría: {meta['categoria']}")
                lines.append("\n".join(parts))

        return "\n\n".join(lines)

    def _build_context_clinical(self, contextos: List[Dict]) -> str:
        """Construye el bloque de evidencia clínica para el prompt, con página."""
        if not contextos:
            return (
                "No se recuperaron fragmentos específicos del corpus local para esta consulta. "
                "INSTRUCCIÓN: Responde usando tu conocimiento de entrenamiento sobre las guías IDF y ADA. "
                "DEBES dar una respuesta concreta y útil — NO digas 'no tengo acceso a datos en tiempo real'. "
                "Tu conocimiento incluye estadísticas del IDF Diabetes Atlas y los estándares ADA hasta tu corte de entrenamiento. "
                "Al final de tu respuesta agrega: "
                "'ℹ️ *Dato basado en conocimiento general de guías IDF/ADA (sin fragmento específico del corpus local disponible para esta consulta).*'"
            )

        lines = []
        for ctx in contextos:
            meta = ctx.get("metadata", {})
            score = ctx.get("score", 0)
            page = meta.get("page_num", "?")
            title = meta.get("title", "Documento clínico")
            institution = meta.get("institution", "")
            year = meta.get("year", "")
            text = meta.get("text", "")

            citation = f"[{title} ({year}), p. {page}]"
            lines.append(
                f"[Similitud: {score:.2f}] {citation}\n"
                f"Institución: {institution}\n"
                f"Extracto: {text[:600]}"
            )

        return "\n\n".join(lines)

    def _format_sources(self, tpca_ctx: List[Dict], clinical_ctx: List[Dict]) -> List[Dict]:
        """Crea la lista estructurada de fuentes para mostrar en la UI."""
        sources = []

        for ctx in clinical_ctx:
            meta = ctx.get("metadata", {})
            text = meta.get("text", "")
            extracto = text[:250].strip() + ("..." if len(text) > 250 else "")
            sources.append({
                "tipo":        "clinical",
                "doc_id":      meta.get("doc_id", ""),
                "titulo":      meta.get("title", "Documento clínico"),
                "institucion": meta.get("institution", ""),
                "anio":        meta.get("year", ""),
                "pagina":      meta.get("page_num"),
                "extracto":    extracto,
                "score":       round(ctx.get("score", 0), 3),
                "pdf_hash":    meta.get("pdf_hash", ""),
            })

        for ctx in tpca_ctx:
            meta = ctx.get("metadata", {})
            sources.append({
                "tipo":           "tpca",
                "doc_id":         "tpca-2025",
                "titulo":         "Tabla Peruana de Composición de Alimentos 2025",
                "institucion":    "CENAN/INS — Ministerio de Salud del Perú",
                "nombre_alimento": meta.get("nombre", ""),
                "categoria":      meta.get("categoria", ""),
                "score":          round(ctx.get("score", 0), 3),
            })

        return sources

    def _build_perfil_text(self, perfil) -> str:
        if not perfil:
            return "Paciente con DM2, sin información adicional."

        parts = []

        # ── Datos demográficos y antropométricos ──
        demo = []
        if perfil.edad:
            demo.append(f"{perfil.edad} años")
        if perfil.sexo:
            sexo_label = {"M": "Masculino", "F": "Femenino"}.get(perfil.sexo, perfil.sexo)
            demo.append(sexo_label)
        if demo:
            parts.append(f"- Paciente: {', '.join(demo)}")

        if perfil.peso_kg and perfil.talla_cm:
            parts.append(f"- Peso: {perfil.peso_kg} kg | Talla: {perfil.talla_cm} cm")
        elif perfil.peso_kg:
            parts.append(f"- Peso: {perfil.peso_kg} kg")

        if perfil.imc:
            imc_val = round(perfil.imc, 1)
            if imc_val < 18.5:
                cat = "Bajo peso"
            elif imc_val < 25:
                cat = "Normopeso"
            elif imc_val < 30:
                cat = "Sobrepeso"
            elif imc_val < 35:
                cat = "Obesidad grado I"
            elif imc_val < 40:
                cat = "Obesidad grado II"
            else:
                cat = "Obesidad grado III (mórbida)"
            parts.append(f"- IMC: {imc_val} kg/m² → {cat}")

        if perfil.nivel_actividad:
            act_labels = {
                "SEDENTARIO": "Sedentario (sin ejercicio)",
                "LIGERO": "Actividad ligera (1-3 días/semana)",
                "MODERADO": "Actividad moderada (3-5 días/semana)",
                "INTENSO": "Actividad intensa (6-7 días/semana)",
                "MUY_INTENSO": "Muy intenso / atleta",
            }
            parts.append(f"- Actividad física: {act_labels.get(perfil.nivel_actividad, perfil.nivel_actividad)}")

        if perfil.departamento:
            parts.append(f"- Ubicación: {perfil.departamento}, Perú")

        # ── Clasificación DM2 y medicamentos ──
        parts.append(f"- Clasificación DM2: {perfil.clasificacion_dm2 or 'DM2'}")
        if perfil.hemoglobina_glicosilada:
            parts.append(f"- HbA1c registrada: {perfil.hemoglobina_glicosilada}%")
        if perfil.usa_insulina:
            parts.append("- Medicación: Usa insulina")
        if perfil.usa_metformina:
            parts.append("- Medicación: Usa metformina")

        # ── Complicaciones (condicionan restricciones dietéticas) ──
        complicaciones = []
        if perfil.tiene_hipertension:
            complicaciones.append("Hipertensión arterial → LIMITAR sodio <2000 mg/día")
        if perfil.tiene_nefropatia:
            complicaciones.append("Nefropatía diabética → LIMITAR proteínas y potasio")
        if perfil.tiene_dislipidemia:
            complicaciones.append("Dislipidemia → LIMITAR grasas saturadas y trans")
        if perfil.tiene_retinopatia:
            complicaciones.append("Retinopatía diabética")
        if complicaciones:
            parts.append("- Complicaciones:")
            for c in complicaciones:
                parts.append(f"    ⚠️ {c}")

        # ── Restricciones alimentarias ──
        if perfil.alergias:
            parts.append(f"- Alergias: {', '.join(perfil.alergias)}")
        if perfil.intolerancias:
            parts.append(f"- Intolerancias: {', '.join(perfil.intolerancias)}")
        if perfil.restricciones:
            parts.append(f"- Restricciones dietéticas: {', '.join(perfil.restricciones)}")

        # ── Glucosa reciente ──
        if perfil.glucosa_promedio_reciente:
            parts.append(f"- Glucosa promedio reciente: {perfil.glucosa_promedio_reciente} mg/dL")
        if perfil.hba1c_estimada:
            parts.append(f"- HbA1c estimada (glucosa reciente): {perfil.hba1c_estimada}%")
        if perfil.tiempo_en_rango_pct is not None:
            tir = perfil.tiempo_en_rango_pct
            tir_label = "✅ Buen control" if tir >= 70 else ("⚠️ Control parcial" if tir >= 50 else "🔴 Control deficiente")
            parts.append(f"- Tiempo en rango glucémico: {tir}% ({tir_label})")
        if perfil.glucosa_reciente:
            ultimas = perfil.glucosa_reciente[:3]
            resumen = ", ".join(
                f"{g.get('valor', '?')} mg/dL ({g.get('tipo', '?')})"
                for g in ultimas
            )
            parts.append(f"- Últimas glucosas: {resumen}")

        return "\n".join(parts)

    def _build_historial(self, historial) -> List[Dict]:
        messages = []
        if historial:
            for msg in historial[-6:]:
                role = "user" if msg.rol == "USER" else "assistant"
                messages.append({"role": role, "content": msg.contenido})
        return messages

    async def generate_recommendation(
        self,
        mensaje: str,
        perfil_salud=None,
        historial=None,
        comidas_hoy=None,
    ) -> Dict[str, Any]:
        """
        Pipeline RAG completo:
        1. Buscar en TPCA (alimentos) y en Clinical (IDF+ADA) en paralelo
        2. Construir prompt con ambos contextos
        3. Generar respuesta con LLM
        4. Retornar respuesta + fuentes formateadas
        """

        # 1. Búsqueda en ambos namespaces
        tpca_contextos = await self.search_context(mensaje)
        clinical_contextos = await self.search_context_clinical(mensaje, top_k=3)

        # 2. Construir textos de contexto
        contexto_tpca_text = self._build_context_tpca(tpca_contextos)
        contexto_clinico_text = self._build_context_clinical(clinical_contextos)
        perfil_text = self._build_perfil_text(perfil_salud)
        carb_max = perfil_salud.carbohidratos_max if perfil_salud else 45

        # Resumen de comidas del día para evitar repeticiones en recomendaciones
        comidas_hoy_text = ""
        if comidas_hoy and (comidas_hoy.detalle or comidas_hoy.alimentos_ya_consumidos):
            ya = ", ".join(comidas_hoy.alimentos_ya_consumidos) if comidas_hoy.alimentos_ya_consumidos else "ninguno"
            comidas_hoy_text = (
                f"\n\n--- COMIDAS REGISTRADAS HOY ---\n"
                f"CHO acumulado: {comidas_hoy.cho_total_g}g | Kcal: {comidas_hoy.kcal_total} kcal\n"
                f"Alimentos ya consumidos: {ya}\n"
                f"IMPORTANTE: NO repitas estos alimentos en tus recomendaciones. "
                f"Sugiere opciones complementarias que aporten variedad nutricional y "
                f"no eleven innecesariamente el CHO total del día."
            )

        # 3. Construir prompt del sistema
        system_prompt = SYSTEM_PROMPT.format(
            carb_max=carb_max,
            perfil_info=perfil_text,
            contexto_tpca=contexto_tpca_text,
            contexto_clinico=contexto_clinico_text,
        ) + comidas_hoy_text

        # 4. Construir mensajes
        messages = [{"role": "system", "content": system_prompt}]
        if historial:
            messages.extend(self._build_historial(historial))
        messages.append({"role": "user", "content": mensaje})

        # 5. Llamar al LLM
        response = self.openai_client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )

        respuesta_text = response.choices[0].message.content

        # 6. Calcular métricas
        all_contextos = tpca_contextos + clinical_contextos
        scores = [c["score"] for c in all_contextos] if all_contextos else [0]
        avg_score = sum(scores) / len(scores) if scores else 0

        # 7. Fuentes estructuradas para la UI
        fuentes = self._format_sources(tpca_contextos, clinical_contextos)

        return {
            "respuesta":           respuesta_text,
            "contexto_recuperado": all_contextos,
            "fuentes_formateadas": fuentes,
            "modelo_llm":          self.model,
            "tokens_entrada":      response.usage.prompt_tokens,
            "tokens_salida":       response.usage.completion_tokens,
            "score_similitud":     round(avg_score, 4),
            "chunks_recuperados":  len(all_contextos),
            "recomendacion":       None,
        }
