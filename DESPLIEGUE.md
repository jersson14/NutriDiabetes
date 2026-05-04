# Guía de Despliegue — NutriDiabetes Perú
**Orden obligatorio:** Base de datos → Backend → AI Service → Frontend

---

## Arquitectura de producción

```
Vercel (Next.js)
     ↓ NEXT_PUBLIC_API_URL
Railway Backend (Node.js :PORT)
     ↓ RAG_SERVICE_URL          ↓ DATABASE_URL
Railway AI Service (Python)   Railway PostgreSQL
     ↓
  Pinecone (ya indexado)
```

---

## PASO 1 — Subir código a GitHub

```bash
cd "F:\CONTINENTAL MAESTRIA\ELABORACIÓN DE TESIS\Sistema_Diabetes"

git init
git add .
git commit -m "deploy: configuracion produccion"

# Crear repo en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/nutridiabetes.git
git push -u origin main
```

> ⚠️ Asegúrate de que `.gitignore` excluye los `.env` reales. Solo los `.env.example` deben subir.

---

## PASO 2 — Base de datos PostgreSQL en Railway

### 2.1 Crear la base de datos

1. Ve a [railway.app](https://railway.app) → **New Project**
2. Clic en **Deploy PostgreSQL**
3. Espera ~1 minuto a que levante
4. Ve al servicio PostgreSQL → pestaña **Variables**
5. Copia el valor de `DATABASE_URL` (lo usarás en el Paso 3)

### 2.2 Backup de tu base de datos local (Windows)

```bash
# En Git Bash o PowerShell desde la carpeta del proyecto
pg_dump -U postgres -d nutridiabetes -F p -f backup_nutridiabetes.sql
```

Si `pg_dump` no está en PATH:
```bash
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d nutridiabetes -F p -f backup_nutridiabetes.sql
```

### 2.3 Restaurar en Railway

**Opción A — Terminal:**
```bash
# Reemplaza con tu DATABASE_URL de Railway
psql "postgresql://postgres:PASSWORD@HOST.railway.app:PORT/railway" -f backup_nutridiabetes.sql
```

**Opción B — TablePlus o DBeaver (más fácil):**
1. Conecta con la `DATABASE_URL` de Railway
2. Menú → *Import SQL file* → selecciona `backup_nutridiabetes.sql`
3. Ejecuta

**Opción C — Si la BD está vacía (fresh install):**
```bash
psql "postgresql://postgres:PASSWORD@HOST.railway.app:PORT/railway" -f database/init_database.sql
```

---

## PASO 3 — Backend Node.js en Railway

### 3.1 Crear el servicio

1. En tu proyecto Railway → **New Service** → **GitHub Repo**
2. Selecciona tu repositorio
3. **Root Directory:** `/backend`
4. Railway detecta Node.js automáticamente por el `package.json`

### 3.2 Variables de entorno

Ve al servicio backend → pestaña **Variables** → agrega una por una:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Genera uno: `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `OPENAI_API_KEY` | Tu clave de OpenAI |
| `PINECONE_API_KEY` | Tu clave de Pinecone |
| `PINECONE_INDEX` | `nutri-diabetes-peru` |
| `RAG_SERVICE_URL` | *(dejar vacío por ahora, completar en Paso 4.3)* |
| `FRONTEND_URL` | *(dejar vacío por ahora, completar en Paso 5.3)* |
| `GOOGLE_CLIENT_ID` | `510977984919-6o4l6q2vgp97colpatqiqe16e1l2jfv3.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Tu secret de Google Cloud Console |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX` | `100` |

> ⚠️ **NO agregues `PORT`** — Railway lo asigna automáticamente.

> 💡 `${{Postgres.DATABASE_URL}}` es una referencia interna de Railway que conecta automáticamente con el PostgreSQL del mismo proyecto.

### 3.3 Verificar deploy

Una vez desplegado, Railway te da una URL pública. Prueba:
```
https://TU-BACKEND.railway.app/api/health
```
Respuesta esperada:
```json
{ "status": "ok", "database": "connected" }
```

---

## PASO 4 — AI Service Python en Railway

### 4.1 Crear el servicio

1. En el mismo proyecto Railway → **New Service** → **GitHub Repo**
2. Selecciona tu repositorio
3. **Root Directory:** `/ai-service`
4. Railway detecta Python por `requirements.txt` y usa el `railway.toml` para el comando de inicio

### 4.2 Variables de entorno

| Variable | Valor |
|---|---|
| `OPENAI_API_KEY` | Tu clave de OpenAI |
| `OPENAI_MODEL` | `gpt-4` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `PINECONE_API_KEY` | Tu clave de Pinecone |
| `PINECONE_INDEX` | `nutri-diabetes-peru` |
| `RAG_TOP_K` | `5` |
| `RAG_TEMPERATURE` | `0.3` |
| `RAG_MAX_TOKENS` | `2000` |

> ⚠️ **NO agregues `PORT`** — Railway lo asigna automáticamente.

### 4.3 Conectar con el backend

1. Una vez desplegado, copia la URL pública del AI service
   (algo como `https://ai-service-production-xxxx.railway.app`)
2. Ve al servicio **backend** → Variables
3. Actualiza `RAG_SERVICE_URL` = `https://ai-service-production-xxxx.railway.app`

### 4.4 Verificar deploy

```
https://TU-AI-SERVICE.railway.app/health
```
Respuesta esperada:
```json
{ "status": "ok", "pinecone": "connected", "openai": "configured" }
```

---

## PASO 5 — Frontend Next.js en Vercel

### 5.1 Importar proyecto

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Conecta tu cuenta de GitHub e importa el repositorio
3. **Root Directory:** `frontend`
4. Framework: **Next.js** (se detecta solo)
5. Clic en **Deploy**

### 5.2 Variables de entorno

Vercel → tu proyecto → **Settings** → **Environment Variables**:

| Variable | Valor | Entorno |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://TU-BACKEND.railway.app/api` | Production |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `510977984919-6o4l6q2vgp97colpatqiqe16e1l2jfv3.apps.googleusercontent.com` | Production |

Después de agregar las variables → **Redeploy** (Deployments → los tres puntos → Redeploy).

### 5.3 Actualizar CORS en el backend

1. Copia tu URL de Vercel: `https://nutridiabetes-xxxx.vercel.app`
2. Ve al servicio **backend** en Railway → Variables
3. Actualiza `FRONTEND_URL` = `https://nutridiabetes-xxxx.vercel.app`
4. Railway redespliega automáticamente

### 5.4 Agregar dominio en Google Cloud Console

Para que el login con Google funcione en producción:

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Selecciona tu proyecto → **APIs & Services** → **Credentials**
3. Edita tu OAuth 2.0 Client
4. En **Authorized JavaScript origins** agrega: `https://nutridiabetes-xxxx.vercel.app`
5. En **Authorized redirect URIs** agrega: `https://nutridiabetes-xxxx.vercel.app/auth/callback`
6. Guarda

---

## PASO 6 — Verificación final

Prueba en este orden:

```bash
# 1. Base de datos (Railway → PostgreSQL → Query)
SELECT COUNT(*) FROM alimentos;
# Debe devolver 888

# 2. Backend
curl https://TU-BACKEND.railway.app/api/health

# 3. AI Service
curl https://TU-AI-SERVICE.railway.app/health

# 4. Frontend
# Abre https://nutridiabetes-xxxx.vercel.app
# Inicia sesión → prueba el chat
```

---

## Resumen de URLs a conectar

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Vercel)                                          │
│  NEXT_PUBLIC_API_URL = https://backend.railway.app/api      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Railway)                                          │
│  DATABASE_URL   = ${{Postgres.DATABASE_URL}}                │
│  RAG_SERVICE_URL = https://ai-service.railway.app           │
│  FRONTEND_URL   = https://nutridiabetes.vercel.app          │
└─────────────────────────────────────────────────────────────┘
              ↓                        ↓
┌─────────────────────┐   ┌───────────────────────────────────┐
│  PostgreSQL         │   │  AI Service (Railway)             │
│  (Railway)          │   │  OPENAI_API_KEY = sk-...          │
│  auto DATABASE_URL  │   │  PINECONE_API_KEY = ...           │
└─────────────────────┘   └───────────────────────────────────┘
                                        ↓
                              ┌──────────────────┐
                              │  Pinecone Cloud  │
                              │  (ya indexado)   │
                              └──────────────────┘
```

---

## Problemas comunes

| Error | Causa | Solución |
|---|---|---|
| `SSL required` en BD | SSL no configurado | `DATABASE_URL` en Railway incluye SSL automáticamente |
| `CORS error` en frontend | `FRONTEND_URL` incorrecto | Verifica la URL exacta de Vercel en Railway |
| `502 Bad Gateway` AI service | Puerto incorrecto | El `railway.toml` usa `$PORT`, no tocar |
| Login Google no funciona | Dominio no autorizado | Agregar URL de Vercel en Google Cloud Console |
| `RAG_SERVICE_URL` timeout | AI service no levantó | Revisar logs en Railway → AI Service |

---

## Variables de entorno de referencia rápida

### backend/.env (local — NO subir a GitHub)
```env
NODE_ENV=development
PORT=4000
DATABASE_URL=           # dejar vacío en local, usar DB_* abajo
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nutridiabetes
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=dev_secret_local
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=nutri-diabetes-peru
RAG_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=510977984919-...
GOOGLE_CLIENT_SECRET=...
```

### ai-service/.env (local — NO subir a GitHub)
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
PINECONE_API_KEY=...
PINECONE_INDEX=nutri-diabetes-peru
AI_SERVICE_PORT=8000
RAG_TOP_K=5
RAG_TEMPERATURE=0.3
RAG_MAX_TOKENS=2000
```

### frontend/.env.local (local — NO subir a GitHub)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=510977984919-...
```

---

*Generado para NutriDiabetes Perú — Tesis Maestría Continental 2026*
