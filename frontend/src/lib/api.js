import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,  // 60s para rutas normales
  headers: { 'Content-Type': 'application/json' },
});

// Cliente especial para el chat RAG (respuestas largas + cold start)
const chatApi = axios.create({
  baseURL: API_URL,
  timeout: 200000, // 200s — tiempo suficiente para TPCA + LLM + cold start
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para agregar token JWT (api normal)
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor para agregar token JWT (chatApi)
chatApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor de respuesta (manejar 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  loginGoogle: (googleToken) => api.post('/auth/google', { googleToken }),
  getMe: () => api.get('/auth/me'),
};

// ── Chat ──
export const chatAPI = {
  sendMessage: (mensaje, conversacionId) =>
    chatApi.post('/chat/message', { mensaje, conversacionId }),
  getConversaciones: () => api.get('/chat/conversaciones'),
  getConversacion: (id) => api.get(`/chat/conversacion/${id}`),
  deleteConversacion: (id) => api.delete(`/chat/conversacion/${id}`),
};

// ── Alimentos ──
export const alimentosAPI = {
  getAll: (params) => api.get('/alimentos', { params }),
  getById: (id) => api.get(`/alimentos/${id}`),
  getCategorias: () => api.get('/alimentos/categorias'),
  getRecomendados: () => api.get('/alimentos/recomendados'),
};

// ── Glucosa ──
export const glucosaAPI = {
  registrar: (data) => api.post('/glucosa', data),
  getHistorial: (dias, tipo) => api.get('/glucosa', { params: { dias, tipo } }),
  getTendencia: (dias) => api.get('/glucosa/tendencia', { params: { dias } }),
};

// ── Perfil ──
export const perfilAPI = {
  get: () => api.get('/perfil'),
  updateSalud: (data) => api.put('/perfil/salud', data),
  updateObjetivos: (data) => api.put('/perfil/objetivos', data),
};

// ── Dashboard ──
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
  getMetricas: () => api.get('/dashboard/metricas'),
  sendFeedback: (data) => api.post('/dashboard/feedback', data),
};

// ── Comidas ──
export const comidasAPI = {
  registrar: (data) => api.post('/comidas', data),
  getHoy: () => api.get('/comidas'),
  eliminar: (id) => api.delete(`/comidas/${id}`),
};

// ── Admin ──
export const adminAPI = {
  getStats:            ()           => api.get('/admin/stats'),
  getUsuarios:         (params)     => api.get('/admin/usuarios', { params }),
  getMetricasRAG:      ()           => api.get('/admin/metricas-rag'),
  getConsultas:        (limit, page) => api.get('/admin/consultas', { params: { limit, page } }),
  getLogs:             (limit)      => api.get('/admin/logs', { params: { limit } }),
  toggleUsuarioActivo: (id, activo) => api.put(`/admin/usuarios/${id}/activo`, { activo }),
  cambiarRol:          (id, rol)    => api.put(`/admin/usuarios/${id}/rol`,    { rol }),
  // Gestión de alimentos
  getAlimentos:   (params) => api.get('/admin/alimentos', { params }),
  crearAlimento:  (data)   => api.post('/admin/alimentos', data),
  eliminarAlimento:(id)    => api.delete(`/admin/alimentos/${id}`),
};

export { api };
export default api;
