"""
============================================
Servicio RAG - Pipeline de Recomendación
Query → Embedding → Pinecone → Contexto → LLM → Respuesta
============================================
"""
import os
import json
from typing import Optional, List, Dict, Any
from openai import OpenAI
from pinecone import Pinecone

SYSTEM_PROMPT = """Eres NutriBot Perú, un asistente de salud nutricional especializado en Diabetes Mellitus Tipo 2 (DM2), diseñado para pacientes y profesionales de salud en el Perú.

Estás respaldado por la Tabla Peruana de Composición de Alimentos (TPCA) del CENAN/INS del Ministerio de Salud del Perú, con datos de 888 alimentos de la biodiversidad peruana.

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
FORMATO OBLIGATORIO PARA CONSULTAS CALÓRICAS DIRECTAS
═══════════════════════════════════════════

Si el usuario pregunta directamente cuántas calorías tiene un alimento:
• La PRIMERA ORACIÓN de tu respuesta DEBE tener este formato EXACTO:
  "[Alimento] contiene [X] kcal por 100g según la TPCA CENAN/INS."
  Ejemplo: "La quinua contiene 351 kcal por 100g según la TPCA CENAN/INS."
• Usa el valor EXACTO de los DATOS NUTRICIONALES RECUPERADOS del contexto.
• Nunca reportes calorías por porción sin aclarar explícitamente que es por porción.
• Si el contexto no tiene el alimento consultado, dilo: "No tengo el dato exacto en la TPCA."

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
Ejemplo: "La quinua (IG=53) aporta proteína vegetal y fibra que ralentiza la absorción del azúcar."

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

Para estas preguntas NO necesitas datos de la TPCA, usa tu conocimiento médico general.

═══════════════════════════════════════════
INTELIGENCIA ARTIFICIAL EXPLICABLE (XAI)
═══════════════════════════════════════════

SIEMPRE explica el PORQUÉ de tus recomendaciones. No solo digas "come esto", explica:
• Por qué ese alimento es bueno/malo para DM2
• Qué nutriente específico lo hace beneficioso
• Cómo afecta la glucemia y por qué
• Referencia a la fuente: "Según la TPCA del CENAN/INS..."

Ejemplo: "Te recomiendo el tarwi porque tiene un IG de 15 (muy bajo), 49g de proteína vegetal y 18g de fibra por 100g, lo que ralentiza significativamente la absorción de glucosa."

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
DATOS NUTRICIONALES RECUPERADOS (TPCA CENAN/INS)
═══════════════════════════════════════════
{contexto}
"""


class RAGService:
    def __init__(self):
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("OPENAI_MODEL", "gpt-4")
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        self.top_k = int(os.getenv("RAG_TOP_K", "5"))
        self.temperature = float(os.getenv("RAG_TEMPERATURE", "0.3"))
        self.max_tokens = int(os.getenv("RAG_MAX_TOKENS", "2000"))

        # Pinecone
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
        """Genera embedding para un texto usando OpenAI."""
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding

    # Sinónimos de alimentos peruanos para expandir la consulta y mejorar el recall
    SINONIMOS = {
        "olluco": ["papalisa", "ulluco", "melloco", "ullucu"],
        "papalisa": ["olluco", "ulluco", "melloco"],
        "oca": ["okka", "oxalis tuberosa"],
        "mashua": ["mashwa", "cubio", "isaño"],
        "yuca": ["mandioca", "cassava", "tapioca"],
        "camote": ["boniato", "batata", "sweet potato"],
        "chirimoya": ["anona", "cherimoya"],
        "aguaymanto": ["physalis", "uchuva", "capulí"],
        "camu camu": ["camu-camu", "myrciaria dubia"],
        "tarwi": ["chocho", "lupino", "lupinus mutabilis"],
        "canihua": ["cañihua", "kañiwa", "chenopodium pallidicaule"],
        "kiwicha": ["amaranto", "amaranth"],
        "maca": ["lepidium meyenii"],
        "lucuma": ["lúcuma", "pouteria lucuma"],
        "granadilla": ["passionfruit", "maracuyá dulce"],
    }

    def _expand_query(self, query: str) -> str:
        """Expande la consulta con sinónimos de alimentos peruanos para mejorar recall."""
        q_lower = query.lower()
        extras = []
        for term, synonyms in self.SINONIMOS.items():
            if term in q_lower:
                extras.extend(synonyms)
            else:
                for syn in synonyms:
                    if syn in q_lower:
                        extras.append(term)
                        extras.extend([s for s in synonyms if s != syn])
                        break
        if extras:
            return f"{query} {' '.join(set(extras))}"
        return query

    async def search_context(self, query: str, top_k: int = None) -> List[Dict]:
        """Busca en Pinecone el contexto más relevante.

        Busca en DOS namespaces:
          - default (""): chunks TPCA + manuales
          - clinical:     chunks PDFs clínicos (IDF Atlas, ADA Standards)

        Fusiona, deduplica por ID, ordena por score y filtra por threshold.
        """
        if not self.index:
            return []

        k = top_k or self.top_k
        min_score = float(os.getenv("RAG_SCORE_THRESHOLD", "0.10"))

        # Expandir consulta con sinónimos para mejorar recall
        expanded_query = self._expand_query(query)
        query_embedding = self._get_embedding(expanded_query)

        # Buscar en namespace TPCA (default) y namespace clinical en paralelo
        raw_matches = {}

        for namespace in ["", "clinical"]:
            try:
                results = self.index.query(
                    vector=query_embedding,
                    top_k=k,
                    include_metadata=True,
                    namespace=namespace
                )
                for match in results.matches:
                    mid = match.id
                    score = float(match.score)
                    if mid not in raw_matches or score > raw_matches[mid]["score"]:
                        raw_matches[mid] = {
                            "id":       mid,
                            "score":    score,
                            "metadata": match.metadata if match.metadata else {}
                        }
            except Exception:
                pass  # namespace vacío o error — continuar con el otro

        # Filtrar por threshold y ordenar por score descendente
        contextos = [
            v for v in raw_matches.values()
            if v["score"] >= min_score
        ]
        contextos.sort(key=lambda x: x["score"], reverse=True)
        return contextos[:k * 2]  # Hasta 2×top_k para multi-namespace

    def _build_context_text(self, contextos: List[Dict]) -> str:
        """Construye el texto de contexto desde los resultados de Pinecone."""
        if not contextos:
            return "No se encontró información específica en la TPCA. Usa tu conocimiento general sobre nutrición para DM2 en Perú, pero indica al paciente que la información no proviene de la base de datos oficial."

        lines = []
        for ctx in contextos:
            meta = ctx.get("metadata", {})
            score = ctx.get("score", 0)
            
            # Si el chunk tiene texto completo almacenado, usarlo
            if meta.get("text"):
                lines.append(f"[Similitud: {score:.2f}] {meta['text']}")
            else:
                # Fallback: construir desde metadata
                nombre = meta.get("nombre", "Alimento")
                info_parts = [f"[Similitud: {score:.2f}] 🔹 {nombre}"]

                if meta.get("energia_kcal"):
                    info_parts.append(f"  Energía: {meta['energia_kcal']} kcal/100g")
                if meta.get("proteinas_g"):
                    info_parts.append(f"  Proteínas: {meta['proteinas_g']}g")
                if meta.get("carbohidratos_g"):
                    info_parts.append(f"  Carbohidratos: {meta['carbohidratos_g']}g")
                if meta.get("fibra_g"):
                    info_parts.append(f"  Fibra: {meta['fibra_g']}g")
                if meta.get("indice_glucemico"):
                    info_parts.append(f"  IG: {meta['indice_glucemico']}")
                if meta.get("nivel_recomendacion"):
                    info_parts.append(f"  Clasificación DM2: {meta['nivel_recomendacion']}")
                if meta.get("categoria"):
                    info_parts.append(f"  Categoría: {meta['categoria']}")

                lines.append("\n".join(info_parts))

        return "\n\n".join(lines)

    def _build_perfil_text(self, perfil) -> str:
        """Construye el texto del perfil del paciente."""
        if not perfil:
            return "Paciente con DM2, sin información adicional."

        parts = [f"- Clasificación: {perfil.clasificacion_dm2 or 'DM2'}"]

        if perfil.hemoglobina_glicosilada:
            parts.append(f"- HbA1c: {perfil.hemoglobina_glicosilada}%")
        if perfil.usa_insulina:
            parts.append("- Usa insulina")
        if perfil.usa_metformina:
            parts.append("- Usa metformina")
        if perfil.alergias:
            parts.append(f"- Alergias: {', '.join(perfil.alergias)}")
        if perfil.intolerancias:
            parts.append(f"- Intolerancias: {', '.join(perfil.intolerancias)}")
        if perfil.restricciones:
            parts.append(f"- Restricciones: {', '.join(perfil.restricciones)}")

        return "\n".join(parts)

    # ── Palabras clave para Query Routing ───────────────────────────────────
    _KEYWORDS_CONCEPTO = [
        "qué es", "que es", "cómo funciona", "como funciona",
        "qué significa", "que significa", "definición", "definicion",
        "explícame", "explicame", "cuéntame", "cuentame",
        "hba1c", "hemoglobina glicosilada", "resistencia a la insulina",
        "metformina", "insulina", "sulfonilurea", "dpp-4", "sglt2",
        "nefropatía", "retinopatía", "neuropatía", "pie diabético",
        "hiperglucemia", "hipoglucemia", "cetoacidosis",
        "diabetes tipo 2", "dm2", "complicaciones", "factores de riesgo",
        "ejercicio", "actividad física", "dormir", "estrés",
        "etiqueta nutricional", "glucosa en sangre", "control glucémico",
    ]
    _KEYWORDS_ALIMENTO = [
        "calorías", "calorias", "kcal", "proteínas", "proteinas",
        "carbohidratos", "fibra", "grasas", "índice glucémico",
        "indice glucemico", "ig ", " ig", "carga glucémica",
        "receta", "preparación", "preparacion", "cocinar", "ingredientes",
        "desayuno", "almuerzo", "cena", "merienda", "colación", "snack",
        "puedo comer", "tengo en casa", "combinar", "alimento",
    ]

    def _classify_query(self, mensaje: str) -> str:
        """
        Clasifica la consulta para decidir si usar Pinecone o solo el LLM.
        Returns: 'CONCEPTO_DM2' | 'NUTRICIONAL'
        """
        m = mensaje.lower()
        score_concepto  = sum(1 for kw in self._KEYWORDS_CONCEPTO  if kw in m)
        score_alimento  = sum(1 for kw in self._KEYWORDS_ALIMENTO  if kw in m)

        # Si hay palabras de alimento → siempre usar Pinecone
        if score_alimento > 0:
            return "NUTRICIONAL"
        # Si hay al menos 1 concepto DM2 y ningún alimento → búsqueda clínica directa
        if score_concepto >= 1 and score_alimento == 0:
            return "CONCEPTO_DM2"
        return "NUTRICIONAL"

    async def _multi_query_search(self, mensaje: str) -> List[Dict]:
        """
        Multi-Query RAG: genera 2 reformulaciones con el LLM y combina resultados
        únicos de todas las búsquedas para maximizar el recall.
        """
        # Generar reformulaciones con el LLM (llamada rápida)
        try:
            resp = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[{
                    "role": "system",
                    "content": (
                        "Eres un experto en nutrición, diabetes y salud. "
                        "Genera EXACTAMENTE 2 reformulaciones alternativas de la siguiente "
                        "consulta para mejorar la búsqueda semántica en una base de datos "
                        "que contiene información nutricional (TPCA) y guías clínicas (IDF, ADA). "
                        "Si la consulta es sobre un alimento, usa sinónimos peruanos "
                        "(ej: olluco/papalisa, tarwi/chocho). "
                        "Si es sobre diabetes o salud, usa términos clínicos alternativos. "
                        "Responde solo con las 2 reformulaciones, una por línea, sin numeración."
                    )
                }, {
                    "role": "user",
                    "content": mensaje
                }],
                temperature=0.3,
                max_tokens=120,
            )
            reformulaciones = resp.choices[0].message.content.strip().split("\n")
            reformulaciones = [r.strip() for r in reformulaciones if r.strip()][:2]
        except Exception:
            reformulaciones = []

        # Buscar con el mensaje original + reformulaciones
        todas_queries = [mensaje] + reformulaciones
        ids_vistos: set = set()
        contextos_merged: List[Dict] = []

        for query in todas_queries:
            try:
                resultados = await self.search_context(query)
                for ctx in resultados:
                    if ctx["id"] not in ids_vistos:
                        ids_vistos.add(ctx["id"])
                        contextos_merged.append(ctx)
            except Exception:
                pass

        # Ordenar por score descendente y tomar los mejores top_k*2
        contextos_merged.sort(key=lambda x: x.get("score", 0), reverse=True)
        return contextos_merged[:self.top_k * 2]

    def _build_historial(self, historial) -> List[Dict]:
        """Convierte el historial al formato de OpenAI."""
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
        historial=None
    ) -> Dict[str, Any]:
        """
        Pipeline RAG mejorado:
        1. Query Routing — ¿necesita búsqueda en Pinecone?
        2. Multi-Query Search — reformulaciones para maximizar recall
        3. Construir prompt con contexto enriquecido
        4. Generar respuesta con LLM
        5. Retornar respuesta + métricas
        """
        tipo_query = self._classify_query(mensaje)

        # ── 1. Búsqueda en Pinecone ──────────────────────────────────────────
        # CONCEPTO_DM2: busca con top_k reducido (solo para citas clínicas IDF/ADA)
        # NUTRICIONAL:  Multi-Query completo para maximizar recall en TPCA
        usa_multi_query = int(os.getenv("RAG_MULTI_QUERY", "1"))
        if tipo_query == "CONCEPTO_DM2":
            contextos = await self.search_context(mensaje, top_k=3)
        elif usa_multi_query and len(mensaje) > 20:
            contextos = await self._multi_query_search(mensaje)
        else:
            contextos = await self.search_context(mensaje)

        # ── 2. Construir textos ───────────────────────────────────────────────
        contexto_text = self._build_context_text(contextos)
        perfil_text   = self._build_perfil_text(perfil_salud)
        carb_max      = perfil_salud.carbohidratos_max if perfil_salud else 45

        # ── 3. Construir prompt del sistema ──────────────────────────────────
        system_prompt = SYSTEM_PROMPT.format(
            carb_max=carb_max,
            perfil_info=perfil_text,
            contexto=contexto_text
        )

        # ── 4. Construir mensajes ─────────────────────────────────────────────
        messages = [{"role": "system", "content": system_prompt}]
        if historial:
            messages.extend(self._build_historial(historial))
        messages.append({"role": "user", "content": mensaje})

        # ── 5. Llamar al LLM ─────────────────────────────────────────────────
        response = self.openai_client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )
        respuesta_text = response.choices[0].message.content

        # ── 6. Calcular métricas ─────────────────────────────────────────────
        scores    = [c["score"] for c in contextos] if contextos else [0]
        avg_score = sum(scores) / len(scores) if scores else 0

        # ── 7. Formatear fuentes para trazabilidad en el frontend ────────────
        fuentes_formateadas = self._format_fuentes(contextos, tipo_query)

        return {
            "respuesta":            respuesta_text,
            "contexto_recuperado":  contextos,
            "fuentes_formateadas":  fuentes_formateadas,
            "modelo_llm":           self.model,
            "tokens_entrada":       response.usage.prompt_tokens,
            "tokens_salida":        response.usage.completion_tokens,
            "score_similitud":      round(avg_score, 4),
            "chunks_recuperados":   len(contextos),
            "tipo_query":           tipo_query,
            "recomendacion":        None,
        }

    @staticmethod
    def _es_texto_util(texto: str) -> bool:
        """Verifica que el chunk no sea solo números/tablas (poca utilidad como cita)."""
        if not texto or len(texto) < 60:
            return False
        # Si más del 60% son dígitos/puntuación numérica → probablemente tabla
        letras = sum(1 for c in texto if c.isalpha())
        return letras / len(texto) > 0.3

    def _format_fuentes(self, contextos: List[Dict], tipo_query: str = "NUTRICIONAL") -> List[Dict]:
        """Formatea los contextos recuperados en fuentes citables para el frontend.

        Siempre retorna al menos 1 fuente para garantizar la trazabilidad en la UI.
        - Chunks TPCA/manual  → cita la TPCA 2025 CENAN/INS
        - Chunks clínicos     → cita IDF Atlas / ADA Standards con extracto
        - Sin chunks (debajo del threshold) → citas base según tipo de consulta
        """
        fuentes = []
        ids_vistos = set()

        for ctx in contextos:
            meta        = ctx.get("metadata", {})
            score       = ctx.get("score", 0)
            source_type = meta.get("source_type", "")
            texto_raw   = (meta.get("text", "") or "")

            if source_type in ("atlas_clinico", "guia_clinica", "clinical"):
                doc_id = meta.get("doc_id", "")
                pagina = meta.get("page_num", meta.get("pagina"))

                clave = f"{doc_id}__p{pagina}"
                if clave in ids_vistos:
                    continue

                lineas_utiles = [
                    l.strip() for l in texto_raw.split('\n')
                    if len(l.strip()) > 30 and sum(1 for c in l if c.isalpha()) / max(len(l), 1) > 0.4
                ]
                extracto = " ".join(lineas_utiles[:3])[:250] if lineas_utiles else texto_raw[:200]

                fuentes.append({
                    "tipo":        "clinical",
                    "doc_id":      doc_id,
                    "titulo":      meta.get("title", meta.get("titulo", "")),
                    "institucion": meta.get("institution", meta.get("institucion", "")),
                    "anio":        meta.get("year", meta.get("anio")),
                    "pagina":      pagina,
                    "extracto":    extracto,
                    "score":       round(score, 3),
                    "pdf_hash":    meta.get("pdf_hash", ""),
                })
                ids_vistos.add(clave)

            else:
                nombre = meta.get("nombre_comun") or meta.get("nombre", "")
                if nombre and nombre not in ids_vistos:
                    fuentes.append({
                        "tipo":            "tpca",
                        "doc_id":          "tpca-2025",
                        "titulo":          "Tabla Peruana de Composición de Alimentos 2025",
                        "institucion":     "CENAN/INS — Ministerio de Salud del Perú",
                        "nombre_alimento": nombre,
                        "categoria":       meta.get("categoria", ""),
                        "score":           round(score, 3),
                    })
                    ids_vistos.add(nombre)

        # ── Fallbacks: garantizar al menos 1 fuente siempre ─────────────────
        hay_tpca     = any(f["tipo"] == "tpca"     for f in fuentes)
        hay_clinical = any(f["tipo"] == "clinical" for f in fuentes)

        # Para consultas conceptuales DM2, agregar citas clínicas de referencia
        if tipo_query == "CONCEPTO_DM2" and not hay_clinical:
            fuentes.insert(0, {
                "tipo":        "clinical",
                "doc_id":      "idf-atlas-2025",
                "titulo":      "IDF Diabetes Atlas 2025",
                "institucion": "International Diabetes Federation (IDF)",
                "anio":        "2025",
                "pagina":      None,
                "extracto":    (
                    "El Atlas de Diabetes de la IDF es la fuente global más completa sobre "
                    "epidemiología, diagnóstico, clasificación y manejo de la diabetes mellitus. "
                    "Proporciona estadísticas mundiales y guías de práctica clínica."
                ),
                "score":       1.0,
                "pdf_hash":    "",
            })
            fuentes.insert(1, {
                "tipo":        "clinical",
                "doc_id":      "ada-standards-2026",
                "titulo":      "Standards of Medical Care in Diabetes 2026",
                "institucion": "American Diabetes Association (ADA)",
                "anio":        "2026",
                "pagina":      None,
                "extracto":    (
                    "Los Estándares de Atención Médica en Diabetes de la ADA son la guía clínica "
                    "de referencia para el diagnóstico, clasificación, objetivos glucémicos, "
                    "farmacoterapia y manejo de complicaciones de la DM2."
                ),
                "score":       1.0,
                "pdf_hash":    "",
            })

        # Siempre mostrar la TPCA como fuente base de datos nutricional
        if not hay_tpca:
            fuentes.append({
                "tipo":            "tpca",
                "doc_id":          "tpca-2025",
                "titulo":          "Tabla Peruana de Composición de Alimentos 2025",
                "institucion":     "CENAN/INS — Ministerio de Salud del Perú",
                "nombre_alimento": "Base de datos nutricional",
                "categoria":       "888 alimentos de la biodiversidad peruana",
                "score":           1.0,
            })

        return fuentes
