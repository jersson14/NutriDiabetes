"""
============================================
Servicio de Embeddings
Genera embeddings de alimentos y los indexa en Pinecone
============================================
"""
import os
from typing import List, Dict, Any
from openai import OpenAI
from pinecone import Pinecone


class EmbeddingsService:
    def __init__(self):
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

        try:
            pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
            index_name = os.getenv("PINECONE_INDEX", "nutri-diabetes-peru")
            self.index = pc.Index(index_name)
        except Exception as e:
            print(f"⚠️ Pinecone no disponible: {e}")
            self.index = None

    def _create_food_text(self, alimento: Dict) -> str:
        """Crea un texto descriptivo del alimento para generar embedding."""
        parts = [
            f"Alimento: {alimento.get('nombre', '')}",
        ]

        if alimento.get('nombre_comun'):
            parts.append(f"Nombre común: {alimento['nombre_comun']}")
        if alimento.get('categoria'):
            parts.append(f"Categoría: {alimento['categoria']}")

        # Información nutricional por 100g
        nutri = []
        if alimento.get('energia_kcal'):
            nutri.append(f"Energía: {alimento['energia_kcal']} kcal")
        if alimento.get('proteinas_g'):
            nutri.append(f"Proteínas: {alimento['proteinas_g']}g")
        if alimento.get('carbohidratos_totales_g'):
            nutri.append(f"Carbohidratos: {alimento['carbohidratos_totales_g']}g")
        if alimento.get('fibra_dietaria_g'):
            nutri.append(f"Fibra: {alimento['fibra_dietaria_g']}g")
        if alimento.get('grasas_totales_g'):
            nutri.append(f"Grasas: {alimento['grasas_totales_g']}g")

        if nutri:
            parts.append("Nutrición por 100g: " + ", ".join(nutri))

        # Info para diabetes
        if alimento.get('indice_glucemico') is not None:
            ig = alimento['indice_glucemico']
            clasif = "BAJO" if ig <= 55 else ("MEDIO" if ig <= 69 else "ALTO")
            parts.append(f"Índice glucémico: {ig} ({clasif})")

        if alimento.get('nivel_recomendacion'):
            parts.append(f"Para diabetes tipo 2: {alimento['nivel_recomendacion']}")

        if alimento.get('origen_region'):
            parts.append(f"Región de Perú: {alimento['origen_region']}")

        return ". ".join(parts)

    def _get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Genera embeddings para un lote de textos."""
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=texts
        )
        return [item.embedding for item in response.data]

    async def generate_and_upload(self, alimentos: List[Dict[str, Any]]) -> Dict:
        """
        Genera embeddings para una lista de alimentos y los sube a Pinecone.
        """
        if not self.index:
            return {"error": "Pinecone no conectado", "uploaded": 0}

        total_uploaded = 0
        batch_size = 50  # Procesar de 50 en 50
        errors = []

        for i in range(0, len(alimentos), batch_size):
            batch = alimentos[i:i + batch_size]

            # Crear textos descriptivos
            texts = [self._create_food_text(a) for a in batch]

            try:
                # Generar embeddings
                embeddings = self._get_embeddings_batch(texts)

                # Preparar vectores para Pinecone
                vectors = []
                for j, (alimento, embedding) in enumerate(zip(batch, embeddings)):
                    vector_id = alimento.get('id', f"food_{i+j}")

                    metadata = {
                        "nombre": alimento.get("nombre", ""),
                        "nombre_comun": alimento.get("nombre_comun", ""),
                        "categoria": alimento.get("categoria", ""),
                        "energia_kcal": float(alimento.get("energia_kcal", 0) or 0),
                        "proteinas_g": float(alimento.get("proteinas_g", 0) or 0),
                        "carbohidratos_g": float(alimento.get("carbohidratos_totales_g", 0) or 0),
                        "fibra_g": float(alimento.get("fibra_dietaria_g", 0) or 0),
                        "grasas_g": float(alimento.get("grasas_totales_g", 0) or 0),
                        "indice_glucemico": int(alimento.get("indice_glucemico", 0) or 0),
                        "nivel_recomendacion": alimento.get("nivel_recomendacion", "POR_EVALUAR"),
                        "es_apto_diabeticos": bool(alimento.get("es_apto_diabeticos", True)),
                        "texto": texts[j][:500],  # Limitar metadata
                    }

                    vectors.append({
                        "id": str(vector_id),
                        "values": embedding,
                        "metadata": metadata
                    })

                # Subir a Pinecone
                self.index.upsert(vectors=vectors)
                total_uploaded += len(vectors)
                print(f"✅ Subidos {total_uploaded}/{len(alimentos)} alimentos a Pinecone")

            except Exception as e:
                errors.append(f"Batch {i}: {str(e)}")
                print(f"❌ Error en batch {i}: {e}")

        return {
            "message": f"Embeddings generados y subidos a Pinecone",
            "total_alimentos": len(alimentos),
            "uploaded": total_uploaded,
            "errors": errors if errors else None
        }
