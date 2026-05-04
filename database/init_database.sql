-- ============================================================
-- SISTEMA DE RECOMENDACIONES NUTRICIONALES PARA DIABETES
-- Base de Datos PostgreSQL - Script de Inicialización
-- Autor: Sistema RAG - Tesis Maestría Continental
-- Fecha: 2026-04-11
-- Versión: 1.1
-- Enfoque: Diabetes Mellitus Tipo 2 (DM2)
-- ============================================================

-- ============================================================
-- 0. EXTENSIONES Y CONFIGURACIÓN
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TIPOS ENUMERADOS
-- ============================================================

-- Clasificación clínica del paciente con DM2
CREATE TYPE clasificacion_dm2 AS ENUM (
    'DM2_SIN_COMPLICACIONES',      -- Diabetes Tipo 2 sin complicaciones
    'DM2_CON_COMPLICACIONES',      -- Con nefropatía, retinopatía, etc.
    'DM2_CONTROLADA',              -- HbA1c < 7%
    'DM2_NO_CONTROLADA',           -- HbA1c >= 7%
    'PRE_DIABETES'                 -- Glucosa en ayunas 100-125 mg/dL
);

-- Nivel de actividad física
CREATE TYPE nivel_actividad AS ENUM (
    'SEDENTARIO',
    'LIGERO',
    'MODERADO',
    'ACTIVO',
    'MUY_ACTIVO'
);

-- Nivel de recomendación del alimento para diabéticos
CREATE TYPE nivel_recomendacion_alimento AS ENUM (
    'RECOMENDADO',    -- IG bajo, alto en fibra - consumo libre
    'MODERADO',       -- IG medio - controlar porciones
    'LIMITAR',        -- IG alto - consumo mínimo/evitar
    'POR_EVALUAR'     -- Sin datos suficientes
);

-- Rol de usuario
CREATE TYPE rol_usuario AS ENUM (
    'PACIENTE',
    'NUTRICIONISTA',
    'ADMINISTRADOR'
);

-- Tipo de comida
CREATE TYPE tipo_comida AS ENUM (
    'DESAYUNO',
    'MEDIA_MANANA',
    'ALMUERZO',
    'MEDIA_TARDE',
    'CENA',
    'SNACK'
);

-- Tipo de medición de glucosa
CREATE TYPE tipo_medicion_glucosa AS ENUM (
    'AYUNAS',
    'PRE_PRANDIAL',
    'POST_PRANDIAL_1H',
    'POST_PRANDIAL_2H',
    'ANTES_DORMIR',
    'ALEATORIA'
);

-- Rol del mensaje en la conversación
CREATE TYPE rol_mensaje AS ENUM (
    'USER',
    'ASSISTANT',
    'SYSTEM'
);

-- Estado de la conversación
CREATE TYPE estado_conversacion AS ENUM (
    'ACTIVA',
    'FINALIZADA',
    'ARCHIVADA'
);

-- ============================================================
-- 2. DOMINIO: USUARIOS Y AUTENTICACIÓN
-- ============================================================

-- Tabla de usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    nombre_completo VARCHAR(200) NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    rol rol_usuario NOT NULL DEFAULT 'PACIENTE',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_google_id ON usuarios(google_id);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

-- Perfil de salud del paciente (enfocado en DM2)
CREATE TABLE perfiles_salud (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Datos personales
    fecha_nacimiento DATE,
    sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
    peso_kg DECIMAL(5,2) CHECK (peso_kg > 0 AND peso_kg < 500),
    talla_cm DECIMAL(5,2) CHECK (talla_cm > 0 AND talla_cm < 300),
    imc DECIMAL(5,2),  -- Calculado automáticamente
    circunferencia_cintura_cm DECIMAL(5,2), -- Factor de riesgo cardiovascular
    
    -- Datos clínicos DM2
    clasificacion_dm2 clasificacion_dm2 NOT NULL DEFAULT 'DM2_SIN_COMPLICACIONES',
    anio_diagnostico INTEGER CHECK (anio_diagnostico >= 1950 AND anio_diagnostico <= 2030),
    hemoglobina_glicosilada DECIMAL(4,2), -- HbA1c (%) - meta < 7%
    glucosa_ayunas_promedio DECIMAL(6,2), -- mg/dL
    glucosa_postprandial_promedio DECIMAL(6,2), -- mg/dL (2h después de comer)
    
    -- Tratamiento farmacológico DM2
    usa_insulina BOOLEAN DEFAULT FALSE,
    usa_metformina BOOLEAN DEFAULT FALSE,      -- Medicamento más común DM2
    usa_sulfonilureas BOOLEAN DEFAULT FALSE,   -- Glibenclamida, etc.
    usa_inhibidores_dpp4 BOOLEAN DEFAULT FALSE, -- Sitagliptina, etc.
    otros_medicamentos TEXT,
    dosis_medicamentos JSONB, -- {"metformina": "850mg/2veces", ...}
    
    -- Complicaciones DM2
    tiene_hipertension BOOLEAN DEFAULT FALSE,
    tiene_dislipidemia BOOLEAN DEFAULT FALSE,
    tiene_nefropatia BOOLEAN DEFAULT FALSE,
    tiene_retinopatia BOOLEAN DEFAULT FALSE,
    tiene_neuropatia BOOLEAN DEFAULT FALSE,
    
    -- Estilo de vida
    nivel_actividad nivel_actividad DEFAULT 'SEDENTARIO',
    horas_suenio_promedio DECIMAL(3,1),
    fuma BOOLEAN DEFAULT FALSE,
    consume_alcohol BOOLEAN DEFAULT FALSE,
    
    -- Restricciones alimentarias
    alergias TEXT[], -- Array de alergias
    intolerancias TEXT[], -- Array de intolerancias (lactosa, gluten, etc.)
    restricciones_dieteticas TEXT[], -- Vegetariano, vegano, etc.
    
    -- Ubicación (para contextualizar alimentos regionales peruanos)
    departamento VARCHAR(100),
    provincia VARCHAR(100),
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perfiles_usuario ON perfiles_salud(usuario_id);
CREATE INDEX idx_perfiles_clasificacion ON perfiles_salud(clasificacion_dm2);

-- Objetivos nutricionales del paciente
CREATE TABLE objetivos_nutricionales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Metas calóricas
    calorias_diarias_min INTEGER CHECK (calorias_diarias_min > 0),
    calorias_diarias_max INTEGER CHECK (calorias_diarias_max > 0),
    
    -- Macronutrientes (en gramos por día)
    carbohidratos_max_g DECIMAL(6,2),
    proteinas_min_g DECIMAL(6,2),
    grasas_max_g DECIMAL(6,2),
    fibra_min_g DECIMAL(6,2),
    
    -- Restricciones para diabetes
    carbohidratos_por_comida_max_g DECIMAL(6,2) DEFAULT 45.00, -- ADA recomienda 45-60g
    sodio_max_mg DECIMAL(8,2) DEFAULT 2300.00, -- mg/día
    
    -- Metas de glucosa (mg/dL)
    glucosa_objetivo_min DECIMAL(6,2) DEFAULT 70.00,
    glucosa_objetivo_max DECIMAL(6,2) DEFAULT 130.00,
    glucosa_postprandial_max DECIMAL(6,2) DEFAULT 180.00,
    
    definido_por VARCHAR(100), -- 'SISTEMA', 'NUTRICIONISTA', 'PACIENTE'
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_objetivos_usuario ON objetivos_nutricionales(usuario_id);

-- ============================================================
-- 3. DOMINIO: ALIMENTOS Y NUTRICIÓN (CORE)
-- ============================================================

-- Categorías de la Tabla Peruana de Alimentos
CREATE TABLE categorias_alimentos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    icono VARCHAR(10), -- Emoji representativo
    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categorias_codigo ON categorias_alimentos(codigo);

-- Tabla principal de alimentos (basada en TPCA - CENAN/INS)
CREATE TABLE alimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_tpca VARCHAR(20) UNIQUE, -- Código alfanumérico oficial TPCA
    
    -- Identificación
    nombre VARCHAR(300) NOT NULL,
    nombre_comun VARCHAR(300), -- Nombre popular/regional
    nombre_cientifico VARCHAR(300),
    categoria_id INTEGER NOT NULL REFERENCES categorias_alimentos(id),
    
    -- Composición por 100g de porción comestible
    energia_kcal DECIMAL(8,2),       -- Energía (kcal)
    energia_kj DECIMAL(8,2),         -- Energía (kJ)
    agua_g DECIMAL(8,2),             -- Agua (g)
    proteinas_g DECIMAL(8,2),        -- Proteínas (g)
    grasas_totales_g DECIMAL(8,2),   -- Grasa total (g)
    carbohidratos_totales_g DECIMAL(8,2),      -- Carbohidratos totales (g)
    carbohidratos_disponibles_g DECIMAL(8,2),  -- Carbohidratos disponibles (g)
    fibra_dietaria_g DECIMAL(8,2),   -- Fibra dietaria (g)
    cenizas_g DECIMAL(8,2),          -- Cenizas (g)
    
    -- Minerales (mg por 100g)
    calcio_mg DECIMAL(8,2),
    fosforo_mg DECIMAL(8,2),
    hierro_mg DECIMAL(8,2),
    zinc_mg DECIMAL(8,2),
    sodio_mg DECIMAL(8,2),
    potasio_mg DECIMAL(8,2),
    magnesio_mg DECIMAL(8,2),
    
    -- Vitaminas (por 100g)
    retinol_mcg DECIMAL(8,2),        -- Vitamina A (mcg)
    tiamina_mg DECIMAL(8,4),         -- Vitamina B1 (mg)
    riboflavina_mg DECIMAL(8,4),     -- Vitamina B2 (mg)
    niacina_mg DECIMAL(8,4),         -- Vitamina B3 (mg)
    vitamina_c_mg DECIMAL(8,2),      -- Vitamina C (mg)
    acido_folico_mcg DECIMAL(8,2),   -- Ácido fólico (mcg)
    
    -- Datos específicos para diabetes
    indice_glucemico INTEGER CHECK (indice_glucemico >= 0 AND indice_glucemico <= 100),
    carga_glucemica DECIMAL(6,2),
    porcion_referencia_g DECIMAL(8,2) DEFAULT 100.00,
    
    -- Clasificación para el sistema
    nivel_recomendacion nivel_recomendacion_alimento DEFAULT 'POR_EVALUAR',
    es_apto_diabeticos BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    origen_region VARCHAR(100), -- Región de Perú
    disponibilidad_estacional VARCHAR(100), -- 'TODO_AÑO', 'VERANO', etc.
    costo_aproximado VARCHAR(20), -- 'BAJO', 'MEDIO', 'ALTO'
    notas TEXT,
    
    -- Vectorización (para RAG)
    embedding_generado BOOLEAN DEFAULT FALSE,
    pinecone_id VARCHAR(100),
    
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_alimentos_nombre ON alimentos(nombre);
CREATE INDEX idx_alimentos_nombre_comun ON alimentos(nombre_comun);
CREATE INDEX idx_alimentos_codigo_tpca ON alimentos(codigo_tpca);
CREATE INDEX idx_alimentos_categoria ON alimentos(categoria_id);
CREATE INDEX idx_alimentos_ig ON alimentos(indice_glucemico);
CREATE INDEX idx_alimentos_recomendacion ON alimentos(nivel_recomendacion);
CREATE INDEX idx_alimentos_apto ON alimentos(es_apto_diabeticos);
CREATE INDEX idx_alimentos_busqueda ON alimentos USING gin(to_tsvector('spanish', nombre || ' ' || COALESCE(nombre_comun, '')));

-- Tabla de referencia de índice glucémico (fuentes internacionales)
CREATE TABLE indice_glucemico_referencia (
    id SERIAL PRIMARY KEY,
    alimento_id UUID REFERENCES alimentos(id) ON DELETE CASCADE,
    valor_ig INTEGER NOT NULL CHECK (valor_ig >= 0 AND valor_ig <= 100),
    clasificacion VARCHAR(20) NOT NULL CHECK (clasificacion IN ('BAJO', 'MEDIO', 'ALTO')),
    -- BAJO: 0-55, MEDIO: 56-69, ALTO: 70+
    fuente VARCHAR(300), -- Paper, tabla internacional
    porcion_g DECIMAL(6,2),
    carga_glucemica DECIMAL(6,2),
    notas TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ig_ref_alimento ON indice_glucemico_referencia(alimento_id);

-- ============================================================
-- 4. DOMINIO: CHATBOT Y CONVERSACIONES RAG
-- ============================================================

-- Conversaciones (sesiones de chat)
CREATE TABLE conversaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(300),
    estado estado_conversacion NOT NULL DEFAULT 'ACTIVA',
    contexto_salud JSONB, -- Snapshot del perfil de salud al momento de la conversación
    total_mensajes INTEGER DEFAULT 0,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversaciones_usuario ON conversaciones(usuario_id);
CREATE INDEX idx_conversaciones_estado ON conversaciones(estado);
CREATE INDEX idx_conversaciones_fecha ON conversaciones(fecha_creacion DESC);

-- Mensajes del chat
CREATE TABLE mensajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
    rol rol_mensaje NOT NULL,
    contenido TEXT NOT NULL,
    
    -- Metadata RAG (solo para mensajes del assistant)
    contexto_recuperado JSONB, -- Documentos recuperados de Pinecone
    alimentos_mencionados UUID[], -- IDs de alimentos referenciados
    prompt_utilizado TEXT, -- Prompt enviado al LLM
    modelo_llm VARCHAR(100), -- 'gpt-4', 'gemini-pro', etc.
    tokens_entrada INTEGER,
    tokens_salida INTEGER,
    tiempo_respuesta_ms INTEGER,
    
    -- Métricas de recuperación
    score_similitud_promedio DECIMAL(5,4), -- Coseno promedio de los chunks recuperados
    chunks_recuperados INTEGER,
    
    orden INTEGER NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mensajes_conversacion ON mensajes(conversacion_id);
CREATE INDEX idx_mensajes_rol ON mensajes(rol);
CREATE INDEX idx_mensajes_fecha ON mensajes(fecha_creacion);

-- Ingredientes que el usuario reporta tener en su cocina
CREATE TABLE ingredientes_usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    conversacion_id UUID REFERENCES conversaciones(id) ON DELETE SET NULL,
    
    alimento_id UUID REFERENCES alimentos(id) ON DELETE SET NULL,
    nombre_ingresado VARCHAR(200) NOT NULL, -- Lo que el usuario escribió
    cantidad_aproximada VARCHAR(100), -- "medio kilo", "2 unidades", etc.
    
    fue_identificado BOOLEAN DEFAULT FALSE, -- Si se pudo mapear a un alimento de la BD
    confianza_mapeo DECIMAL(4,3), -- 0.000 a 1.000
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredientes_usuario ON ingredientes_usuario(usuario_id);
CREATE INDEX idx_ingredientes_conversacion ON ingredientes_usuario(conversacion_id);
CREATE INDEX idx_ingredientes_alimento ON ingredientes_usuario(alimento_id);

-- Recomendaciones generadas por el sistema
CREATE TABLE recomendaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
    mensaje_id UUID REFERENCES mensajes(id) ON DELETE SET NULL,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Contenido de la recomendación
    titulo VARCHAR(300) NOT NULL,
    descripcion TEXT NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'RECETA', -- 'RECETA', 'COMBINACION', 'CONSEJO'
    
    -- Información nutricional total estimada
    calorias_totales DECIMAL(8,2),
    carbohidratos_totales_g DECIMAL(8,2),
    proteinas_totales_g DECIMAL(8,2),
    grasas_totales_g DECIMAL(8,2),
    fibra_total_g DECIMAL(8,2),
    indice_glucemico_estimado INTEGER,
    carga_glucemica_estimada DECIMAL(6,2),
    
    -- Porciones
    porciones INTEGER DEFAULT 1,
    tiempo_preparacion_min INTEGER,
    dificultad VARCHAR(20) CHECK (dificultad IN ('FACIL', 'MEDIO', 'AVANZADO')),
    
    -- Validación
    es_segura_para_diabeticos BOOLEAN DEFAULT TRUE,
    advertencias TEXT[],
    
    -- Costo estimado
    costo_estimado_soles DECIMAL(8,2),
    
    aceptada_por_usuario BOOLEAN,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recomendaciones_conversacion ON recomendaciones(conversacion_id);
CREATE INDEX idx_recomendaciones_usuario ON recomendaciones(usuario_id);
CREATE INDEX idx_recomendaciones_tipo ON recomendaciones(tipo);

-- Recetas generadas (detalle completo con pasos de preparación)
CREATE TABLE recetas_generadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recomendacion_id UUID NOT NULL REFERENCES recomendaciones(id) ON DELETE CASCADE,
    
    nombre VARCHAR(300) NOT NULL,
    descripcion_corta TEXT, -- Resumen breve de la receta
    
    -- Pasos de preparación completos
    instrucciones_preparacion TEXT NOT NULL, -- Pasos detallados
    pasos_json JSONB, -- [{"paso": 1, "descripcion": "...", "tiempo_min": 5}, ...]
    
    -- Información de preparación
    tiempo_preparacion_min INTEGER,
    tiempo_coccion_min INTEGER,
    tiempo_total_min INTEGER,
    
    -- Tips médicos para DM2
    tips_para_diabeticos TEXT, -- Consejos específicos para DM2
    impacto_glucemico TEXT, -- Explicación del impacto en glucosa
    mejor_momento_consumo VARCHAR(50), -- 'DESAYUNO', 'ALMUERZO', 'CENA'
    
    -- Alternativas
    alternativas_sugeridas TEXT, -- Si no tiene algún ingrediente
    alternativas_json JSONB, -- [{"original": "papa", "alternativa": "camote", "razon": "menor IG"}]
    
    -- Información adicional
    origen_receta VARCHAR(100), -- 'PERUANA', 'ANDINA', 'CRIOLLA', etc.
    region_tipica VARCHAR(100), -- Región de Perú
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recetas_recomendacion ON recetas_generadas(recomendacion_id);

-- Ingredientes de cada receta con cantidades
CREATE TABLE receta_ingredientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receta_id UUID NOT NULL REFERENCES recetas_generadas(id) ON DELETE CASCADE,
    alimento_id UUID REFERENCES alimentos(id) ON DELETE SET NULL,
    
    nombre_ingrediente VARCHAR(200) NOT NULL,
    cantidad DECIMAL(8,2),
    unidad_medida VARCHAR(50), -- 'g', 'ml', 'unidad', 'taza', 'cucharada'
    es_opcional BOOLEAN DEFAULT FALSE,
    nota VARCHAR(300), -- "picado", "al gusto", etc.
    
    -- Aporte nutricional de este ingrediente en esta receta
    calorias_aporte DECIMAL(8,2),
    carbohidratos_aporte_g DECIMAL(8,2),
    
    orden INTEGER NOT NULL DEFAULT 0,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receta_ingredientes_receta ON receta_ingredientes(receta_id);
CREATE INDEX idx_receta_ingredientes_alimento ON receta_ingredientes(alimento_id);

-- ============================================================
-- 5. DOMINIO: SEGUIMIENTO Y SALUD
-- ============================================================

-- Registros de glucosa del paciente
CREATE TABLE registros_glucosa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    
    valor_mg_dl DECIMAL(6,2) NOT NULL CHECK (valor_mg_dl > 0 AND valor_mg_dl < 1000),
    tipo_medicion tipo_medicion_glucosa NOT NULL,
    
    -- Contexto
    notas TEXT,
    comida_asociada_id UUID, -- Se puede vincular a una comida
    
    -- Estado
    esta_en_rango BOOLEAN, -- Calculado según objetivos del paciente
    
    fecha_medicion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_glucosa_usuario ON registros_glucosa(usuario_id);
CREATE INDEX idx_glucosa_fecha ON registros_glucosa(fecha_medicion DESC);
CREATE INDEX idx_glucosa_tipo ON registros_glucosa(tipo_medicion);

-- Registro de comidas realizadas
CREATE TABLE registro_comidas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    
    tipo_comida tipo_comida NOT NULL,
    fecha_comida TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Resumen nutricional calculado
    calorias_total DECIMAL(8,2),
    carbohidratos_total_g DECIMAL(8,2),
    proteinas_total_g DECIMAL(8,2),
    grasas_total_g DECIMAL(8,2),
    fibra_total_g DECIMAL(8,2),
    
    -- Vinculación con recomendación
    recomendacion_id UUID REFERENCES recomendaciones(id) ON DELETE SET NULL,
    fue_recomendacion_sistema BOOLEAN DEFAULT FALSE,
    
    notas TEXT,
    foto_url TEXT, -- URL de foto de la comida (opcional)
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comidas_usuario ON registro_comidas(usuario_id);
CREATE INDEX idx_comidas_fecha ON registro_comidas(fecha_comida DESC);
CREATE INDEX idx_comidas_tipo ON registro_comidas(tipo_comida);

-- Detalle de alimentos en cada comida
CREATE TABLE comida_alimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comida_id UUID NOT NULL REFERENCES registro_comidas(id) ON DELETE CASCADE,
    alimento_id UUID REFERENCES alimentos(id) ON DELETE SET NULL,
    
    nombre_alimento VARCHAR(200) NOT NULL,
    cantidad_g DECIMAL(8,2), -- Cantidad en gramos
    
    -- Aporte calculado
    calorias DECIMAL(8,2),
    carbohidratos_g DECIMAL(8,2),
    proteinas_g DECIMAL(8,2),
    grasas_g DECIMAL(8,2),
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comida_alimentos_comida ON comida_alimentos(comida_id);
CREATE INDEX idx_comida_alimentos_alimento ON comida_alimentos(alimento_id);

-- ============================================================
-- 6. DOMINIO: ANALYTICS Y MÉTRICAS (TESIS)
-- ============================================================

-- Métricas del sistema RAG para evaluación de tesis
CREATE TABLE metricas_sistema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identificación
    tipo_metrica VARCHAR(50) NOT NULL,
    -- Valores: 'MAPE', 'COSENO', 'SUS', 'PRECISION', 'RECALL', 'F1', 'TIEMPO_RESPUESTA'
    
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    
    -- Valores
    valor DECIMAL(10,6) NOT NULL,
    unidad VARCHAR(50), -- '%', 'score', 'ms', etc.
    
    -- Contexto
    conversacion_id UUID REFERENCES conversaciones(id) ON DELETE SET NULL,
    mensaje_id UUID REFERENCES mensajes(id) ON DELETE SET NULL,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    
    -- Parámetros del experimento
    parametros JSONB, -- Config del RAG al momento de la medición
    modelo_llm VARCHAR(100),
    total_chunks_recuperados INTEGER,
    
    -- Evaluación
    evaluado_por VARCHAR(100), -- 'SISTEMA', 'EXPERTO', 'USUARIO'
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metricas_tipo ON metricas_sistema(tipo_metrica);
CREATE INDEX idx_metricas_fecha ON metricas_sistema(fecha_creacion DESC);
CREATE INDEX idx_metricas_conversacion ON metricas_sistema(conversacion_id);

-- Feedback del usuario sobre las recomendaciones
CREATE TABLE feedback_usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    recomendacion_id UUID REFERENCES recomendaciones(id) ON DELETE SET NULL,
    mensaje_id UUID REFERENCES mensajes(id) ON DELETE SET NULL,
    
    -- Calificación
    calificacion INTEGER NOT NULL CHECK (calificacion >= 1 AND calificacion <= 5),
    
    -- Criterios específicos (1-5)
    relevancia INTEGER CHECK (relevancia >= 1 AND relevancia <= 5), -- ¿Fue relevante a sus ingredientes?
    claridad INTEGER CHECK (claridad >= 1 AND claridad <= 5), -- ¿Fue clara la recomendación?
    utilidad INTEGER CHECK (utilidad >= 1 AND utilidad <= 5), -- ¿Le sirvió realmente?
    confianza INTEGER CHECK (confianza >= 1 AND confianza <= 5), -- ¿Confía en la recomendación?
    
    comentario TEXT,
    
    -- Para SUS (System Usability Scale)
    sus_respuestas JSONB, -- Las 10 preguntas del SUS
    sus_score DECIMAL(5,2),
    
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_usuario ON feedback_usuario(usuario_id);
CREATE INDEX idx_feedback_recomendacion ON feedback_usuario(recomendacion_id);

-- ============================================================
-- 7. TABLA DE SESIONES / TOKENS (para JWT)
-- ============================================================

CREATE TABLE sesiones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL, -- SHA-256 del refresh token
    dispositivo VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    es_pwa BOOLEAN DEFAULT FALSE,
    expira_en TIMESTAMPTZ NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_token ON sesiones(token_hash);
CREATE INDEX idx_sesiones_activa ON sesiones(activa);

-- ============================================================
-- 8. TABLAS DE CONFIGURACIÓN DEL SISTEMA
-- ============================================================

-- Configuración general del sistema
CREATE TABLE configuracion_sistema (
    clave VARCHAR(100) PRIMARY KEY,
    valor TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'STRING', -- STRING, INTEGER, BOOLEAN, JSON
    descripcion TEXT,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Logs de actividad (auditoría)
CREATE TABLE logs_actividad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(100), -- Nombre de la tabla afectada
    entidad_id UUID,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_address INET,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_usuario ON logs_actividad(usuario_id);
CREATE INDEX idx_logs_accion ON logs_actividad(accion);
CREATE INDEX idx_logs_fecha ON logs_actividad(fecha_creacion DESC);

-- ============================================================
-- 9. FUNCIONES Y TRIGGERS
-- ============================================================

-- Función para actualizar fecha_actualizacion automáticamente
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con fecha_actualizacion
CREATE TRIGGER trg_usuarios_timestamp
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_perfiles_timestamp
    BEFORE UPDATE ON perfiles_salud
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_objetivos_timestamp
    BEFORE UPDATE ON objetivos_nutricionales
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_alimentos_timestamp
    BEFORE UPDATE ON alimentos
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_conversaciones_timestamp
    BEFORE UPDATE ON conversaciones
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- Función para calcular IMC automáticamente
CREATE OR REPLACE FUNCTION fn_calcular_imc()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.peso_kg IS NOT NULL AND NEW.talla_cm IS NOT NULL AND NEW.talla_cm > 0 THEN
        NEW.imc = ROUND(NEW.peso_kg / POWER(NEW.talla_cm / 100.0, 2), 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calcular_imc
    BEFORE INSERT OR UPDATE ON perfiles_salud
    FOR EACH ROW EXECUTE FUNCTION fn_calcular_imc();

-- Función para incrementar contador de mensajes
CREATE OR REPLACE FUNCTION fn_incrementar_mensajes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversaciones 
    SET total_mensajes = total_mensajes + 1 
    WHERE id = NEW.conversacion_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incrementar_mensajes
    AFTER INSERT ON mensajes
    FOR EACH ROW EXECUTE FUNCTION fn_incrementar_mensajes();

-- Función para clasificar alimento según IG
CREATE OR REPLACE FUNCTION fn_clasificar_alimento_ig()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.indice_glucemico IS NOT NULL THEN
        IF NEW.indice_glucemico <= 55 THEN
            NEW.nivel_recomendacion = 'RECOMENDADO';
            NEW.es_apto_diabeticos = TRUE;
        ELSIF NEW.indice_glucemico <= 69 THEN
            NEW.nivel_recomendacion = 'MODERADO';
            NEW.es_apto_diabeticos = TRUE;
        ELSE
            NEW.nivel_recomendacion = 'LIMITAR';
            NEW.es_apto_diabeticos = FALSE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clasificar_ig
    BEFORE INSERT OR UPDATE ON alimentos
    FOR EACH ROW EXECUTE FUNCTION fn_clasificar_alimento_ig();

-- Función para verificar si glucosa está en rango
CREATE OR REPLACE FUNCTION fn_verificar_glucosa_rango()
RETURNS TRIGGER AS $$
DECLARE
    v_min DECIMAL;
    v_max DECIMAL;
BEGIN
    SELECT glucosa_objetivo_min, glucosa_objetivo_max 
    INTO v_min, v_max
    FROM objetivos_nutricionales 
    WHERE usuario_id = NEW.usuario_id;
    
    IF v_min IS NOT NULL AND v_max IS NOT NULL THEN
        NEW.esta_en_rango = (NEW.valor_mg_dl >= v_min AND NEW.valor_mg_dl <= v_max);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verificar_glucosa
    BEFORE INSERT ON registros_glucosa
    FOR EACH ROW EXECUTE FUNCTION fn_verificar_glucosa_rango();

-- ============================================================
-- 10. VISTAS ÚTILES
-- ============================================================

-- Vista: Resumen diario de nutrición por usuario
CREATE OR REPLACE VIEW vw_resumen_diario_nutricion AS
SELECT 
    rc.usuario_id,
    DATE(rc.fecha_comida) AS fecha,
    COUNT(DISTINCT rc.id) AS total_comidas,
    COALESCE(SUM(rc.calorias_total), 0) AS calorias_dia,
    COALESCE(SUM(rc.carbohidratos_total_g), 0) AS carbohidratos_dia_g,
    COALESCE(SUM(rc.proteinas_total_g), 0) AS proteinas_dia_g,
    COALESCE(SUM(rc.grasas_total_g), 0) AS grasas_dia_g,
    COALESCE(SUM(rc.fibra_total_g), 0) AS fibra_dia_g
FROM registro_comidas rc
GROUP BY rc.usuario_id, DATE(rc.fecha_comida);

-- Vista: Alimentos recomendados para diabéticos con IG
CREATE OR REPLACE VIEW vw_alimentos_recomendados AS
SELECT 
    a.id,
    a.codigo_tpca,
    a.nombre,
    a.nombre_comun,
    ca.nombre AS categoria,
    a.energia_kcal,
    a.carbohidratos_disponibles_g,
    a.fibra_dietaria_g,
    a.proteinas_g,
    a.indice_glucemico,
    a.carga_glucemica,
    a.nivel_recomendacion,
    a.costo_aproximado
FROM alimentos a
JOIN categorias_alimentos ca ON a.categoria_id = ca.id
WHERE a.activo = TRUE
  AND a.es_apto_diabeticos = TRUE
ORDER BY a.indice_glucemico ASC NULLS LAST, a.fibra_dietaria_g DESC NULLS LAST;

-- Vista: Dashboard de métricas del sistema (para tesis)
CREATE OR REPLACE VIEW vw_dashboard_metricas AS
SELECT 
    tipo_metrica,
    COUNT(*) AS total_mediciones,
    ROUND(AVG(valor)::numeric, 4) AS promedio,
    ROUND(MIN(valor)::numeric, 4) AS minimo,
    ROUND(MAX(valor)::numeric, 4) AS maximo,
    ROUND(STDDEV(valor)::numeric, 4) AS desviacion_estandar,
    modelo_llm
FROM metricas_sistema
GROUP BY tipo_metrica, modelo_llm
ORDER BY tipo_metrica;

-- Vista: Historial de glucosa con tendencia
CREATE OR REPLACE VIEW vw_glucosa_tendencia AS
SELECT 
    rg.usuario_id,
    rg.valor_mg_dl,
    rg.tipo_medicion,
    rg.esta_en_rango,
    rg.fecha_medicion,
    DATE(rg.fecha_medicion) AS fecha,
    AVG(rg.valor_mg_dl) OVER (
        PARTITION BY rg.usuario_id 
        ORDER BY rg.fecha_medicion 
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS promedio_movil_7
FROM registros_glucosa rg
ORDER BY rg.fecha_medicion DESC;

-- ============================================================
-- 11. DATOS INICIALES DE CONFIGURACIÓN
-- ============================================================

INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion) VALUES
('APP_NOMBRE', 'NutriDiabetes Perú', 'STRING', 'Nombre de la aplicación'),
('APP_VERSION', '1.0.0', 'STRING', 'Versión actual'),
('RAG_MODEL', 'gpt-4', 'STRING', 'Modelo LLM principal para RAG'),
('RAG_EMBEDDING_MODEL', 'text-embedding-3-small', 'STRING', 'Modelo de embeddings'),
('RAG_TOP_K', '5', 'INTEGER', 'Cantidad de chunks a recuperar de Pinecone'),
('RAG_TEMPERATURE', '0.3', 'STRING', 'Temperatura del LLM para recomendaciones'),
('RAG_MAX_TOKENS', '2000', 'INTEGER', 'Máximo de tokens en la respuesta'),
('PINECONE_INDEX', 'nutri-diabetes-peru', 'STRING', 'Nombre del índice en Pinecone'),
('CARB_MAX_POR_COMIDA_G', '45', 'INTEGER', 'Carbohidratos máximos por comida (g) - ADA'),
('GLUCOSA_AYUNAS_NORMAL_MAX', '100', 'INTEGER', 'Glucosa en ayunas normal máxima (mg/dL)'),
('GLUCOSA_DIABETES_MIN', '126', 'INTEGER', 'Glucosa en ayunas mínima para diabetes (mg/dL)'),
('IG_BAJO_MAX', '55', 'INTEGER', 'IG máximo para clasificar como BAJO'),
('IG_MEDIO_MAX', '69', 'INTEGER', 'IG máximo para clasificar como MEDIO');

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================

-- Para verificar la creación:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
