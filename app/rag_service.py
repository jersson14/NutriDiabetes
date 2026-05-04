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
• En CADA recomendación de comida, instruye al paciente a comer en este ORDEN:
  1.° VEGETALES y FIBRA (ensalada, verduras)
  2.° PROTEÍNA (pollo, pescado, huevo, legumbres)
  3.° CARBOHIDRATOS (al final)
• Explica: "Este orden reduce el pico glucémico posprandial hasta en un 74% según estudios clínicos."
• Sugiere esperar 5-10 minutos entre cada grupo de alimentos.

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

🥦 **Orden de consumo (Food Sequencing):**
1.° Come primero: [vegetales/ensalada]
2.° Luego: [proteína]
3.° Al final: [carbohidratos]

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

    async def search_context(self, query: str, top_k: int = None) -> List[Dict]:
        """Busca en Pinecone el contexto más relevante."""
        if not self.index:
            return []

        k = top_k or self.top_k
        query_embedding = self._get_embedding(query)

        results = self.index.query(
            vector=query_embedding,
            top_k=k,
            include_metadata=True
        )

        contextos = []
        for match in results.matches:
            contextos.append({
                "id": match.id,
                "score": float(match.score),
                "metadata": match.metadata if match.metadata else {}
            })

        return contextos

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

    def _build_historial(self, historial) -> List[Dict]:
        """Convierte el historial al formato de OpenAI."""
        messages = []
        if historial:
            for msg in historial[-6:]:  # Últimos 6 mensajes
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
        Pipeline RAG completo:
        1. Generar embedding del mensaje
        2. Buscar contexto en Pinecone
        3. Construir prompt con contexto
        4. Generar respuesta con LLM
        5. Retornar respuesta + métricas
        """

        # 1. Buscar contexto relevante en Pinecone
        contextos = await self.search_context(mensaje)

        # 2. Construir textos
        contexto_text = self._build_context_text(contextos)
        perfil_text = self._build_perfil_text(perfil_salud)
        carb_max = perfil_salud.carbohidratos_max if perfil_salud else 45

        # 3. Construir prompt del sistema
        system_prompt = SYSTEM_PROMPT.format(
            carb_max=carb_max,
            perfil_info=perfil_text,
            contexto=contexto_text
        )

        # 4. Construir mensajes
        messages = [{"role": "system", "content": system_prompt}]

        # Agregar historial
        if historial:
            messages.extend(self._build_historial(historial))

        # Agregar mensaje actual
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
        scores = [c["score"] for c in contextos] if contextos else [0]
        avg_score = sum(scores) / len(scores) if scores else 0

        return {
            "respuesta": respuesta_text,
            "contexto_recuperado": contextos,
            "modelo_llm": self.model,
            "tokens_entrada": response.usage.prompt_tokens,
            "tokens_salida": response.usage.completion_tokens,
            "score_similitud": round(avg_score, 4),
            "chunks_recuperados": len(contextos),
            "recomendacion": None  # El LLM genera texto libre, se puede parsear después
        }
