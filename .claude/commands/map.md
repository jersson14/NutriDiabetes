# NutriDiabetes Perú — Mapa completo del proyecto

Carga este mapa antes de hacer cualquier cambio en el código. Contiene las rutas exactas, estructura, endpoints y responsabilidades de cada archivo del proyecto para evitar errores.

---

## ARQUITECTURA GENERAL

```
Stack:
- Frontend:   Next.js 14 + React 18 + Tailwind CSS + PWA  → Puerto 3000
- Backend:    Express.js + PostgreSQL                       → Puerto 4000
- AI-Service: FastAPI + OpenAI + Pinecone (RAG)            → Puerto 8000
```

---

## ÁRBOL COMPLETO DE ARCHIVOS

```
Sistema_Diabetes/
│
├── main.py                          ← FastAPI RAG (duplicado de ai-service/main.py)
├── requirements.txt                 ← deps Python: FastAPI, OpenAI, Pinecone, etc.
├── comparacion_rag_vs_llms.py       ← evaluación tesis: RAG vs GPT vs Claude
├── README.md
├── DESPLIEGUE.md
├── despliegue2.md
│
├── ai-service/                      ← Microservicio RAG (Python/FastAPI)
│   ├── main.py                      ← FastAPI app, endpoints /recommend /embed /health
│   ├── requirements.txt
│   ├── .env                         ← OPENAI_API_KEY, PINECONE_API_KEY, etc.
│   └── app/
│       ├── __init__.py
│       ├── rag_service.py           ← Pipeline RAG core: search Pinecone → LLM
│       └── embeddings_service.py    ← Embeddings text-embedding-3-small + Pinecone
│
├── app/                             ← Copia de ai-service/app/ (usada por main.py raíz)
│   ├── __init__.py
│   ├── rag_service.py
│   └── embeddings_service.py
│
├── backend/                         ← API REST (Node.js/Express)
│   ├── package.json
│   └── src/
│       ├── app.js                   ← Express config: CORS, helmet, morgan, rutas
│       ├── server.js                ← Entry point: inicia servidor puerto 4000
│       ├── config/
│       │   └── database.js          ← Pool PostgreSQL + helpers query
│       ├── middleware/
│       │   ├── auth.js              ← verifyToken, generateTokens, requireRole
│       │   └── errorHandler.js      ← Manejo global de errores
│       ├── controllers/
│       │   ├── authController.js    ← Google OAuth, login, register, getMe
│       │   ├── alimentosController.js ← CRUD TPCA, búsqueda, filtros, paginación
│       │   ├── chatController.js    ← Mensajes RAG, conversaciones, llama AI-Service
│       │   ├── comidasController.js ← Registrar/listar/eliminar comidas del día
│       │   ├── glucosaController.js ← Registrar mediciones, historial, tendencias
│       │   ├── perfilController.js  ← Perfil DM2, datos clínicos, objetivos nutri
│       │   ├── dashboardController.js ← Estadísticas agregadas del usuario
│       │   └── adminController.js   ← Panel admin: usuarios, stats globales
│       └── routes/
│           ├── auth.routes.js       ← /api/auth/...
│           ├── alimentos.routes.js  ← /api/alimentos/...
│           ├── chat.routes.js       ← /api/chat/...
│           ├── comidas.routes.js    ← /api/comidas/...
│           ├── glucosa.routes.js    ← /api/glucosa/...
│           ├── perfil.routes.js     ← /api/perfil/...
│           ├── dashboard.routes.js  ← /api/dashboard/...
│           └── admin.routes.js      ← /api/admin/...
│
├── frontend/                        ← Next.js 14 App Router
│   ├── package.json
│   ├── next.config.js               ← PWA config (next-pwa), env vars
│   ├── tailwind.config.js           ← Tema: primary #005BAC, secondary #00A859
│   ├── postcss.config.js
│   ├── jsconfig.json
│   ├── public/
│   │   ├── manifest.json            ← PWA manifest
│   │   └── images/
│   └── src/
│       ├── app/
│       │   ├── layout.js            ← Root layout, metadata, fuentes Inter/Outfit
│       │   ├── page.js              ← Index: redirige a /login o /dashboard
│       │   ├── providers.js         ← GoogleOAuthProvider wrapper
│       │   ├── login/page.js        ← Google OAuth + email/pass + logo custom SVG
│       │   ├── dashboard/page.js    ← Home: glucosa, cards acciones, gráfica 7 días
│       │   ├── chat/page.js         ← Chat RAG + panel fuentes citadas (TPCA/ADA/IDF)
│       │   ├── alimentos/page.js    ← Catálogo TPCA, búsqueda, filtros, modal comida
│       │   ├── comidas/page.js      ← Comidas hoy agrupadas por tipo + totales
│       │   ├── glucosa/page.js      ← Registro glucosa, Recharts LineChart, rangos ADA
│       │   ├── perfil/page.js       ← Perfil DM2: datos clínicos, meds, complicaciones
│       │   └── admin/page.js        ← Panel admin: usuarios, stats, reindexar Pinecone
│       ├── components/
│       │   ├── index.js             ← Barrel export de todos los componentes
│       │   ├── NavBar.jsx           ← Sidebar desktop + bottom nav mobile
│       │   ├── Header.jsx           ← Encabezado con título e icono
│       │   ├── StatCard.jsx         ← Card métrica: label, value, icon, color, trend
│       │   ├── ActionCard.jsx       ← Card accionable con icono y onClick
│       │   ├── InfoCard.jsx         ← Panel informativo con icono
│       │   ├── FormField.jsx        ← Input reutilizable: label, type, value, onChange
│       │   ├── Button.jsx           ← Botón: variant (primary/secondary), loading
│       │   ├── Badge.jsx            ← Etiqueta: label, color, icon
│       │   ├── Tabs.jsx             ← Selector pestañas: tabs[], activeTab, onChange
│       │   ├── GlucoseChart.jsx     ← Recharts LineChart para glucosa histórica
│       │   ├── FilterBar.jsx        ← Barra de filtros con callbacks
│       │   └── InstallPrompt.jsx    ← PWA install banner
│       └── lib/
│           └── api.js               ← Axios instances + interceptores + todos los métodos API
│
├── database/
│   ├── init_database.sql            ← Schema completo: tablas, enums, índices
│   ├── seed_categorias.sql          ← Categorías de alimentos
│   └── seed_alimentos.sql           ← 888+ alimentos TPCA
│
└── scripts/                         ← Utilidades Python
    ├── extraer_tpca_2025.py         ← PDF TPCA → PostgreSQL + Pinecone
    ├── indexar_pdfs_clinicos.py     ← PDFs (IDF, ADA) → Pinecone namespace "clinical"
    ├── subir_a_pinecone.py          ← Batch embeddings → Pinecone
    ├── reindexar_mejorado.py        ← Re-indexación completa con validación
    ├── extraer_pdf_alimentos.py     ← Extrae tabla alimentos de PDF
    ├── agregar_alimentos_manual.py  ← CLI insertar alimentos manuales
    ├── corregir_alimentos_tpca.py   ← Validación y limpieza datos TPCA
    ├── analizar_pdfs.py             ← Análisis estructura PDFs
    ├── debug_clinical_search.py     ← Test búsqueda Pinecone namespace clinical
    ├── debug_pdf.py                 ← Debug extracción pdfplumber
    └── evaluacion/
        ├── generar_data.py          ← Dataset evaluación desde BD
        ├── ragas_evaluacion.py      ← RAGAS: faithfulness, relevancy, precision, recall
        ├── mape_precision.py        ← MAPE calorías + precisión nutricional
        ├── coseno_coherencia.py     ← Similitud coseno + coherencia n-grama
        ├── reporte_final_tesis.py   ← Informe completo con tablas y gráficas
        ├── evaluacion.py
        └── data/
            ├── data.xlsx            ← Dataset: pregunta, texto_ref, kcal_real, contexto
            ├── ragas_resultados.xlsx
            └── graficos/
```

---

## ENDPOINTS API BACKEND (Puerto 4000)

### Auth `/api/auth`
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/google` | No | Login/registro Google OAuth |
| POST | `/register` | No | Registro email + contraseña |
| POST | `/login` | No | Login email + contraseña |
| GET | `/me` | JWT | Datos del usuario autenticado |

### Alimentos `/api/alimentos`
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/` | JWT | Lista alimentos con filtros: `?search=&categoria=&recomendacion=&igMax=&page=&limit=` |
| GET | `/categorias` | JWT | Lista de categorías disponibles |
| GET | `/recomendados` | JWT | Alimentos recomendados para DM2 |
| GET | `/:id` | JWT | Detalles de un alimento |
| POST | `/` | Admin | Crear alimento |
| PUT | `/:id` | Admin | Actualizar alimento |

### Chat RAG `/api/chat`
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/message` | JWT | Enviar mensaje → llama AI-Service RAG |
| GET | `/conversaciones` | JWT | Historial de conversaciones del usuario |
| GET | `/conversacion/:id` | JWT | Detalles de una conversación |
| DELETE | `/conversacion/:id` | JWT | Eliminar conversación |
| GET | `/warmup` | No | Pre-calentar AI Service |

### Comidas `/api/comidas`
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/` | JWT | Registrar comida (tipoComida, alimentoId, cantidadG) |
| GET | `/` | JWT | Comidas registradas hoy |
| DELETE | `/:id` | JWT | Eliminar una comida |

### Glucosa `/api/glucosa`
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/` | JWT | Registrar medición (valor_mg_dl, tipo_medicion, notas) |
| GET | `/` | JWT | Historial `?dias=30&tipo=AYUNAS` |
| GET | `/tendencia` | JWT | Análisis de tendencias |

### Perfil `/api/perfil`
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/` | JWT | Datos completos: usuario + perfil_salud + objetivos |
| PUT | `/salud` | JWT | Actualizar datos clínicos DM2 |
| PUT | `/objetivos` | JWT | Actualizar metas nutricionales |

### Dashboard `/api/dashboard`
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/` | JWT | Stats: última glucosa, comidas hoy, avg carbohidratos |

### Admin `/api/admin`
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/stats` | Admin | Estadísticas globales del sistema |
| GET | `/usuarios` | Admin | Lista paginada de usuarios |
| PUT | `/usuarios/:id` | Admin | Editar usuario |
| DELETE | `/usuarios/:id` | Admin | Desactivar usuario |
| GET | `/conversaciones` | Admin | Conversaciones RAG globales |
| GET | `/alimentos` | Admin | Alimentos en BD |
| POST | `/alimentos` | Admin | Crear alimento batch |

### Health
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | No | Estado del servicio |

---

## ENDPOINTS AI-SERVICE (Puerto 8000)

| Método | Ruta | Body | Descripción |
|--------|------|------|-------------|
| POST | `/recommend` | `{query, perfil_salud}` | Pipeline RAG completo → respuesta + fuentes |
| POST | `/embed` | lista alimentos | Indexar alimentos a Pinecone |
| GET | `/health` | — | Estado del servicio |

---

## RUTAS FRONTEND (Puerto 3000)

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `src/app/page.js` | Redirige según auth |
| `/login` | `src/app/login/page.js` | Google OAuth + email/pass |
| `/dashboard` | `src/app/dashboard/page.js` | Home: glucosa, acciones, gráfica |
| `/chat` | `src/app/chat/page.js` | Chat RAG + panel fuentes |
| `/alimentos` | `src/app/alimentos/page.js` | Catálogo TPCA + registro comidas |
| `/comidas` | `src/app/comidas/page.js` | Comidas del día + totales |
| `/glucosa` | `src/app/glucosa/page.js` | Tracking glucosa + gráfica |
| `/perfil` | `src/app/perfil/page.js` | Perfil DM2 + objetivos |
| `/admin` | `src/app/admin/page.js` | Panel admin |

---

## BASE DE DATOS — TABLAS PRINCIPALES

### Usuarios y Autenticación
```
usuarios             → id(UUID), email, nombre_completo, google_id, avatar_url, rol, activo
perfiles_salud       → usuario_id(FK), datos_personales, datos_dm2, medicamentos, complicaciones
objetivos_nutricionales → usuario_id(FK), kcal_min/max, CHO_max, proteinas_min, etc.
```

### Alimentos TPCA (888+ registros)
```
categorias_alimentos → id, codigo, nombre, icono(emoji), orden
alimentos            → id(UUID), codigo_tpca, nombre, categoria_id, composicion_100g,
                       minerales, vitaminas, indice_glucemico, carga_glucemica,
                       nivel_recomendacion, es_apto_diabeticos, origen_region
indice_glucemico_referencia → alimento_id(FK), valor_ig, clasificacion, fuente
```

### Chat RAG
```
conversaciones       → id(UUID), usuario_id, titulo, estado, contexto_salud(JSONB)
mensajes             → id(UUID), conversacion_id, rol, contenido, contexto_recuperado(JSONB),
                       tokens_entrada, tokens_salida, score_similitud_promedio
ingredientes_usuario → usuario_id, conversacion_id, alimento_id, nombre_ingresado
recomendaciones      → conversacion_id, mensaje_id, tipo(RECETA/CONSEJO), info_nutricional
```

### Datos Paciente
```
registro_comidas     → usuario_id, tipo_comida, fecha_comida, kcal, CHO, proteinas, grasas
registros_glucosa    → usuario_id, valor_mg_dl, tipo_medicion, notas, fecha_creacion
```

### ENUMs importantes
```sql
rol_usuario:               PACIENTE, NUTRICIONISTA, ADMINISTRADOR
clasificacion_dm2:         DM2_SIN_COMPLICACIONES, DM2_CON_COMPLICACIONES,
                           DM2_CONTROLADA, DM2_NO_CONTROLADA, PRE_DIABETES
nivel_actividad:           SEDENTARIO, LIGERO, MODERADO, ACTIVO, MUY_ACTIVO
tipo_comida:               DESAYUNO, MEDIA_MANANA, ALMUERZO, MEDIA_TARDE, CENA, SNACK
tipo_medicion_glucosa:     AYUNAS, PRE_PRANDIAL, POST_PRANDIAL_1H, POST_PRANDIAL_2H,
                           ANTES_DORMIR, ALEATORIA
nivel_recomendacion_alimento: RECOMENDADO, MODERADO, LIMITAR, POR_EVALUAR
```

---

## LIB/API.JS — MÉTODOS DISPONIBLES

```javascript
// Auth
authAPI.loginWithGoogle(googleToken)
authAPI.register(email, password, nombre)
authAPI.login(email, password)
authAPI.getMe()

// Alimentos
alimentosAPI.getAlimentos(page, limit, search, categoria, recomendacion, igMax)
alimentosAPI.getCategorias()
alimentosAPI.getRecomendados()
alimentosAPI.getById(id)

// Chat
chatAPI.sendMessage(conversacionId, mensaje)
chatAPI.getConversaciones()
chatAPI.getConversacion(id)
chatAPI.deleteConversacion(id)
chatAPI.warmup()

// Comidas
comidasAPI.registrar(tipoComida, alimentoId, cantidadG, ...)
comidasAPI.getHoy()
comidasAPI.eliminar(id)

// Glucosa
glucosaAPI.registrar(valorMgDl, tipoMedicion, notas)
glucosaAPI.getHistorial(dias, tipo)
glucosaAPI.getTendencia()

// Perfil
perfilAPI.get()
perfilAPI.updateSalud(datosClinicosObj)
perfilAPI.updateObjetivos(metasObj)

// Dashboard
dashboardAPI.getStats()

// Admin
adminAPI.getStats()
adminAPI.getUsuarios(page, limit)
adminAPI.updateUsuario(id, datos)
adminAPI.deleteUsuario(id)
adminAPI.getConversaciones()
adminAPI.getAlimentos()
```

---

## VARIABLES DE ENTORNO

### Backend (`backend/.env`)
```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL
JWT_SECRET, JWT_EXPIRES_IN
FRONTEND_URL, NODE_ENV, PORT=4000
RAG_SERVICE_URL=http://localhost:8000
RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX
```

### AI-Service (`ai-service/.env`)
```
OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL=text-embedding-3-small, OPENAI_LLM_MODEL=gpt-4-turbo
PINECONE_API_KEY, PINECONE_INDEX=nutri-diabetes-peru
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

---

## DEPENDENCIAS CLAVE

### Backend (Node.js)
```
express, pg, jsonwebtoken, bcryptjs, cors, helmet, morgan, express-rate-limit, uuid, axios, dotenv
```

### Frontend (Next.js)
```
next@14.2.0, react@18.3, tailwindcss@3.4, recharts@2.12, lucide-react@0.441,
@react-oauth/google@0.13.5, axios@1.7.7, next-pwa@5.6
```

### AI-Service (Python)
```
fastapi, uvicorn, openai, pinecone, pydantic, python-dotenv, httpx, numpy
```

---

## REGLAS CLÍNICAS DEL RAG (ai-service/app/rag_service.py)

- **RAG_VERSION:** `v2-clinical`
- **RELEVANCE_THRESHOLD:** `0.20`
- **Namespaces Pinecone:** `tpca-alimentos` (888 alimentos TPCA), `clinical` (IDF Atlas 11th, ADA Standards 2026)
- **Modelo embeddings:** `text-embedding-3-small`
- **Modelo LLM:** `gpt-4-turbo`
- **Reglas nutricionales:** IG ≤ 55 (bajo), máx CHO por comida según perfil, food sequencing (vegetales → proteína → CHO), biodiversidad peruana (tarwi IG=15, aguaymanto IG=25, cañihua)
- **XAI:** Siempre explica por qué recomienda cada alimento

---

## TEMA TAILWIND

```javascript
colors: {
  primary:   '#005BAC',   // Azul salud
  secondary: '#00A859',   // Verde salud
  danger:    '#E53935',   // Rojo diabetes
  warning:   '#FFB300',   // Ámbar precaución
  success:   '#00A859',   // Verde logro
}
fonts: Inter (body), Outfit (headings)
```

---

## INSTRUCCIONES DE USO DE ESTE MAPA

Cuando el usuario pida un cambio:

1. **Identifica el archivo exacto** usando las rutas de este mapa.
2. **Lee el archivo antes de editarlo** con la herramienta Read.
3. **Verifica imports y dependencias** existentes antes de agregar nuevas.
4. **No inventes nombres** de tablas, columnas, endpoints ni componentes — todos están documentados aquí.
5. **Si hay duda**, vuelve a leer el archivo específico con Read antes de editar.
6. **Mantén consistencia** con la nomenclatura existente (camelCase JS, snake_case SQL).
