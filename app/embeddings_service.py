"""
============================================
Servicio de Embeddings — Enriquecido v2
Genera embeddings de alimentos y los indexa en Pinecone.
Incluye sinónimos de alimentos peruanos + Carga Glucémica (CG).
============================================
"""
import os
from typing import List, Dict, Any
from openai import OpenAI
from pinecone import Pinecone

# ── Sinónimos de alimentos peruanos ──────────────────────────────────────────
# Cada entrada: nombre_principal → [sinónimos alternativos]
# Al indexar, todos los nombres se incluyen en el texto para mejorar el recall.
SINONIMOS_ALIMENTOS: Dict[str, List[str]] = {
    "olluco":      ["papalisa", "ulluco", "melloco", "ullucu", "tubérculo andino"],
    "papalisa":    ["olluco", "ulluco", "melloco"],
    "oca":         ["okka", "oxalis tuberosa", "tubérculo andino"],
    "mashua":      ["mashwa", "cubio", "isaño", "tubérculo andino"],
    "yuca":        ["mandioca", "cassava", "tapioca"],
    "camote":      ["boniato", "batata", "sweet potato"],
    "chirimoya":   ["anona", "cherimoya", "custard apple"],
    "aguaymanto":  ["physalis", "uchuva", "capulí", "tomatillo andino"],
    "camu camu":   ["camu-camu", "myrciaria dubia", "fruta amazónica"],
    "tarwi":       ["chocho", "lupino", "lupinus mutabilis", "chochos"],
    "canihua":     ["cañihua", "kañiwa", "chenopodium pallidicaule", "pseudo-cereal andino"],
    "kiwicha":     ["amaranto", "amaranth", "amaranthus caudatus", "pseudo-cereal andino"],
    "maca":        ["lepidium meyenii", "maca andina"],
    "lucuma":      ["lúcuma", "pouteria lucuma", "fruta andina"],
    "granadilla":  ["passionfruit dulce", "passiflora ligularis"],
    "maracuya":    ["maracuyá", "passion fruit", "passiflora edulis"],
    "tuna":        ["nopal fruta", "higo de nopal", "opuntia"],
    "palta":       ["aguacate", "avocado"],
    "papa":        ["patata", "solanum tuberosum"],
    "arroz":       ["arroz blanco", "oryza sativa"],
    "quinua":      ["quinoa", "chenopodium quinoa", "grano andino"],
    "maiz":        ["choclo", "maíz", "corn", "zea mays"],
    "choclo":      ["maíz fresco", "elote", "corn"],
    "habas":       ["fava beans", "vicia faba", "habas secas"],
    "lentejas":    ["lenteja", "lens culinaris"],
    "frijol":      ["poroto", "frejol", "fréjol", "beans", "phaseolus vulgaris"],
    "garbanzo":    ["chickpea", "cicer arietinum"],
    "jurel":       ["jack mackerel", "trachurus murphyi", "pescado azul"],
    "anchoveta":   ["anchovy", "engraulis ringens", "pescado bandera"],
}

# ── Clasificación IG para DM2 ────────────────────────────────────────────────
def _clasificar_ig(ig: float) -> str:
    if ig <= 40:  return "MUY BAJO"
    if ig <= 55:  return "BAJO"
    if ig <= 69:  return "MEDIO"
    return "ALTO"

def _interpretacion_dm2(nivel_recomendacion: str, ig: float = None, fibra: float = None) -> str:
    """Genera texto clínico interpretativo para el contexto del LLM."""
    partes = []
    if nivel_recomendacion == "RECOMENDADO":
        partes.append("alimento RECOMENDADO para pacientes con Diabetes Mellitus Tipo 2 (DM2)")
    elif nivel_recomendacion == "MODERADO":
        partes.append("alimento de consumo MODERADO para pacientes con DM2, en porciones controladas")
    elif nivel_recomendacion == "LIMITAR":
        partes.append("alimento que se debe LIMITAR en la dieta del paciente con DM2")

    if ig is not None and ig > 0:
        clasif = _clasificar_ig(ig)
        partes.append(f"índice glucémico {clasif} ({ig})")
        if ig <= 55:
            partes.append("no eleva bruscamente la glucosa postprandial")
        elif ig >= 70:
            partes.append("puede elevar la glucosa rápidamente")

    if fibra and fibra >= 5:
        partes.append(f"alto contenido de fibra dietaria ({fibra}g/100g) que ralentiza la absorción de glucosa")

    return "; ".join(partes) if partes else ""

def _get_sinonimos(nombre: str, nombre_comun: str = "") -> List[str]:
    """Busca sinónimos para un alimento dado su nombre oficial y nombre común."""
    resultados = set()
    nombres_buscar = [nombre.lower(), (nombre_comun or "").lower()]
    for n in nombres_buscar:
        for clave, syns in SINONIMOS_ALIMENTOS.items():
            if clave in n or n in clave:
                resultados.add(clave)
                resultados.update(syns)
            for s in syns:
                if s in n or n in s:
                    resultados.add(clave)
                    resultados.update(syns)
    # Excluir el nombre original para evitar redundancia
    for n in nombres_buscar:
        resultados.discard(n)
    return list(resultados)


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
        """
        Crea texto descriptivo enriquecido del alimento para generar embedding.
        Incluye: nombre + sinónimos, CG, interpretación DM2, micronutrientes clave.
        """
        nombre        = alimento.get("nombre", "")
        nombre_comun  = alimento.get("nombre_comun", "") or ""
        categoria     = alimento.get("categoria", "") or ""
        energia       = alimento.get("energia_kcal")
        proteinas     = alimento.get("proteinas_g")
        carbs         = alimento.get("carbohidratos_totales_g") or alimento.get("carbohidratos_g")
        carbs_disp    = alimento.get("carbohidratos_disponibles_g") or carbs
        fibra         = alimento.get("fibra_dietaria_g") or alimento.get("fibra_g")
        grasas        = alimento.get("grasas_totales_g") or alimento.get("grasas_g")
        ig            = alimento.get("indice_glucemico")
        nivel_rec     = alimento.get("nivel_recomendacion", "") or ""
        region        = alimento.get("origen_region", "") or ""

        # ── 1. Nombre + sinónimos ────────────────────────────────────────────
        nombre_display = nombre_comun if nombre_comun else nombre
        sinonimos = _get_sinonimos(nombre, nombre_comun)

        parts = [f"Alimento: {nombre_display}"]
        if nombre_comun and nombre_comun.lower() != nombre.lower():
            parts.append(f"También llamado: {nombre}")
        if sinonimos:
            parts.append(f"Otros nombres: {', '.join(sinonimos[:6])}")
        if categoria:
            parts.append(f"Categoría TPCA: {categoria}")
        if region:
            parts.append(f"Origen: {region}")

        # ── 2. Nutrición por 100g ────────────────────────────────────────────
        nutri = []
        if energia:   nutri.append(f"Energía {energia} kcal")
        if proteinas: nutri.append(f"Proteínas {proteinas}g")
        if carbs:     nutri.append(f"Carbohidratos {carbs}g")
        if fibra:     nutri.append(f"Fibra {fibra}g")
        if grasas:    nutri.append(f"Grasas {grasas}g")
        if nutri:
            parts.append("Por 100g: " + ", ".join(nutri))

        # ── 3. Índice Glucémico + Carga Glucémica ────────────────────────────
        if ig and ig > 0:
            clasif_ig = _clasificar_ig(float(ig))
            parts.append(f"Índice Glucémico (IG): {ig} — {clasif_ig}")

            # CG = IG × carbohidratos_disponibles / 100
            if carbs_disp and float(carbs_disp) > 0:
                cg = round(float(ig) * float(carbs_disp) / 100, 1)
                clasif_cg = "BAJA" if cg < 10 else ("MEDIA" if cg < 20 else "ALTA")
                parts.append(f"Carga Glucémica (CG): {cg} — {clasif_cg} (CG = IG × carbs disponibles / 100)")

        # ── 4. Interpretación clínica DM2 ───────────────────────────────────
        interp = _interpretacion_dm2(
            nivel_rec,
            ig=float(ig) if ig else None,
            fibra=float(fibra) if fibra else None
        )
        if interp:
            parts.append(f"Para DM2: {interp}")

        # ── 5. Fuente ────────────────────────────────────────────────────────
        parts.append("Fuente: TPCA CENAN/INS Ministerio de Salud del Perú 2025")

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
        Genera embeddings enriquecidos para una lista de alimentos y los sube a Pinecone.
        """
        if not self.index:
            return {"error": "Pinecone no conectado", "uploaded": 0}

        total_uploaded = 0
        batch_size = 50
        errors = []

        for i in range(0, len(alimentos), batch_size):
            batch = alimentos[i:i + batch_size]
            texts = [self._create_food_text(a) for a in batch]

            try:
                embeddings = self._get_embeddings_batch(texts)

                vectors = []
                for j, (alimento, embedding) in enumerate(zip(batch, embeddings)):
                    vector_id = alimento.get("id", f"food_{i+j}")
                    ig_val = alimento.get("indice_glucemico")
                    carbs_disp = alimento.get("carbohidratos_disponibles_g") or alimento.get("carbohidratos_totales_g") or 0
                    ig_float = float(ig_val) if ig_val else 0.0
                    cg = round(ig_float * float(carbs_disp) / 100, 1) if ig_float > 0 and carbs_disp else 0.0

                    # Construir lista de nombres para búsqueda posterior
                    nombre        = alimento.get("nombre", "")
                    nombre_comun  = alimento.get("nombre_comun", "") or ""
                    sinonimos_lst = _get_sinonimos(nombre, nombre_comun)

                    metadata = {
                        "nombre":              nombre,
                        "nombre_comun":        nombre_comun,
                        "categoria":           alimento.get("categoria", "") or "",
                        "energia_kcal":        float(alimento.get("energia_kcal", 0) or 0),
                        "proteinas_g":         float(alimento.get("proteinas_g", 0) or 0),
                        "carbohidratos_g":     float(alimento.get("carbohidratos_totales_g", 0) or 0),
                        "fibra_g":             float(alimento.get("fibra_dietaria_g", 0) or 0),
                        "grasas_g":            float(alimento.get("grasas_totales_g", 0) or 0),
                        "indice_glucemico":    int(ig_float),
                        "carga_glucemica":     cg,
                        "nivel_recomendacion": alimento.get("nivel_recomendacion", "") or "POR_EVALUAR",
                        "es_apto_diabeticos":  bool(alimento.get("es_apto_diabeticos", True)),
                        "sinonimos":           ", ".join(sinonimos_lst[:8]),
                        "text":                texts[j][:800],
                    }

                    vectors.append({
                        "id": str(vector_id),
                        "values": embedding,
                        "metadata": metadata
                    })

                self.index.upsert(vectors=vectors)
                total_uploaded += len(vectors)
                print(f"✅ Subidos {total_uploaded}/{len(alimentos)} alimentos a Pinecone")

            except Exception as e:
                errors.append(f"Batch {i}: {str(e)}")
                print(f"❌ Error en batch {i}: {e}")

        return {
            "message": "Embeddings enriquecidos generados y subidos a Pinecone",
            "total_alimentos": len(alimentos),
            "uploaded": total_uploaded,
            "errors": errors if errors else None
        }
