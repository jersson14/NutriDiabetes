import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para agregar token JWT
api.interceptors.request.use((config) => {
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
    api.post('/chat/message', { mensaje, conversacionId }),
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

export default api;
