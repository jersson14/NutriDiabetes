'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminAPI } from '@/lib/api';
import {
  Users, MessageCircle, Zap, Clock, Star, Activity,
  BarChart3, TrendingUp, Shield, FileText, RefreshCw,
  CheckCircle2, XCircle, ChevronLeft,
  Database, Brain, Target, Eye, UtensilsCrossed, Plus, Trash2, Leaf
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

/* ── helpers ── */
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('es-PE'); }
function fmtMs(ms) { if (!ms) return '—'; return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtRelative(d) {
  if (!d) return 'Nunca';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

const DM2_LABELS = {
  DM2_CONTROLADA: 'Controlada',
  DM2_NO_CONTROLADA: 'No controlada',
  DM2_SIN_COMPLICACIONES: 'Sin complicaciones',
  DM2_CON_COMPLICACIONES: 'Con complicaciones',
  PRE_DIABETES: 'Pre-diabetes',
};
const DM2_COLORS = {
  DM2_CONTROLADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DM2_NO_CONTROLADA: 'bg-red-50 text-red-700 border-red-200',
  DM2_SIN_COMPLICACIONES: 'bg-blue-50 text-blue-700 border-blue-200',
  DM2_CON_COMPLICACIONES: 'bg-orange-50 text-orange-700 border-orange-200',
  PRE_DIABETES: 'bg-amber-50 text-amber-700 border-amber-200',
};
const ROL_COLORS = {
  PACIENTE: 'bg-blue-50 text-blue-700 border-blue-200',
  NUTRICIONISTA: 'bg-purple-50 text-purple-700 border-purple-200',
  ADMINISTRADOR: 'bg-slate-100 text-slate-700 border-slate-300',
};

const TABS = [
  { id: 'resumen',    label: 'Resumen',      icon: BarChart3       },
  { id: 'pacientes',  label: 'Pacientes',    icon: Users           },
  { id: 'alimentos',  label: 'Alimentos',    icon: UtensilsCrossed },
  { id: 'rag',        label: 'Métricas RAG', icon: Brain           },
  { id: 'consultas',  label: 'Consultas',    icon: MessageCircle   },
  { id: 'logs',       label: 'Logs',         icon: FileText        },
];

const CATEGORIAS = [
  { id: 1,  nombre: 'Cereales y derivados'          },
  { id: 2,  nombre: 'Verduras, hortalizas y derivados' },
  { id: 3,  nombre: 'Frutas y derivados'            },
  { id: 4,  nombre: 'Grasas, aceites y oleaginosas' },
  { id: 5,  nombre: 'Pescados y mariscos'           },
  { id: 6,  nombre: 'Carnes y derivados'            },
  { id: 7,  nombre: 'Leche y derivados'             },
  { id: 8,  nombre: 'Huevos y derivados'            },
  { id: 9,  nombre: 'Leguminosas y derivados'       },
  { id: 10, nombre: 'Tubérculos, raíces y derivados'},
  { id: 11, nombre: 'Azúcares y derivados'          },
  { id: 12, nombre: 'Misceláneos'                   },
  { id: 13, nombre: 'Bebidas'                       },
  { id: 14, nombre: 'Preparaciones y comidas'       },
];

const EMPTY_FORM = {
  nombre: '', nombre_comun: '', categoria_id: '3',
  energia_kcal: '', proteinas_g: '', carbohidratos_totales_g: '',
  grasas_totales_g: '', fibra_dietaria_g: '', calcio_mg: '',
  hierro_mg: '', vitamina_c_mg: '', indice_glucemico: '',
  nivel_recomendacion: 'RECOMENDADO', es_apto_diabeticos: true, notas: '',
};

/* ── sub-components ── */
function KpiCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:    { bg: 'bg-blue-50',    icon: 'bg-[#0057B8]',  text: 'text-[#0057B8]'  },
    green:   { bg: 'bg-emerald-50', icon: 'bg-emerald-600',text: 'text-emerald-600' },
    purple:  { bg: 'bg-purple-50',  icon: 'bg-purple-600', text: 'text-purple-600'  },
    amber:   { bg: 'bg-amber-50',   icon: 'bg-amber-500',  text: 'text-amber-600'   },
    slate:   { bg: 'bg-slate-50',   icon: 'bg-slate-600',  text: 'text-slate-700'   },
    red:     { bg: 'bg-red-50',     icon: 'bg-red-500',    text: 'text-red-600'     },
  };
  const c = colors[color];
  return (
    <div className={`${c.bg} rounded-2xl p-4 border border-white shadow-[0_2px_8px_rgba(15,28,60,0.07)]`}>
      <div className={`w-9 h-9 ${c.icon} rounded-xl flex items-center justify-center mb-3`}>
        <Icon size={17} className="text-white" />
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
      <p className={`text-2xl font-bold ${c.text} mt-1 leading-none tabular-nums`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 font-medium mt-1">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">{children}</p>;
}

function Badge({ label, colorClass }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorClass}`}>
      {label}
    </span>
  );
}

function Pagination({ page, total, limit, onChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 transition-all"
      >
        ← Anterior
      </button>
      <p className="text-xs text-slate-500 font-medium">
        Pág. <span className="font-bold text-slate-800">{page}</span> de {totalPages}
        <span className="text-slate-400 ml-1">({total} registros)</span>
      </p>
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 transition-all"
      >
        Siguiente →
      </button>
    </div>
  );
}

/* ── main component ── */
export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('resumen');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosTotal, setUsuariosTotal] = useState(0);
  const [metricasRAG, setMetricasRAG] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [logs, setLogs] = useState([]);

  // Estado tab Alimentos
  const [alimentos, setAlimentos] = useState([]);
  const [alimentosTotal, setAlimentosTotal] = useState(0);
  const [alimentoSearch, setAlimentoSearch] = useState('');
  const [alimentoPage, setAlimentoPage] = useState(1);
  const ALIMENTO_LIMIT = 10;
  const USUARIO_LIMIT = 10;
  const CONSULTA_LIMIT = 5;

  // Consultas con paginación
  const [consultaPage, setConsultaPage] = useState(1);
  const [consultasTotal, setConsultasTotal] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [guardando, setGuardando] = useState(false);
  const [guardadoMsg, setGuardadoMsg] = useState(null);

  // Filters for patients tab
  const [filterRol, setFilterRol] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPage, setFilterPage] = useState(1);

  const loadAlimentos = useCallback(async (search = '', page = 1) => {
    try {
      const res = await adminAPI.getAlimentos({ search, page, limit: ALIMENTO_LIMIT });
      setAlimentos(res.data.alimentos);
      setAlimentosTotal(res.data.total);
    } catch (e) { console.error(e); }
  }, []);

  const handleCrearAlimento = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setGuardadoMsg(null);
    try {
      const res = await adminAPI.crearAlimento(form);
      const { pinecone_ok } = res.data;
      setGuardadoMsg({
        ok: true,
        texto: `✅ "${form.nombre}" agregado a PostgreSQL${pinecone_ok ? ' y Pinecone' : ' (Pinecone: AI Service no disponible)'}`
      });
      setForm(EMPTY_FORM);
      loadAlimentos(alimentoSearch);
    } catch (err) {
      setGuardadoMsg({ ok: false, texto: `❌ Error: ${err.response?.data?.error || err.message}` });
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarAlimento = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      await adminAPI.eliminarAlimento(id);
      loadAlimentos(alimentoSearch);
    } catch (e) { alert('Error al eliminar'); }
  };

  const loadConsultas = useCallback(async (page = 1) => {
    try {
      const res = await adminAPI.getConsultas(CONSULTA_LIMIT, page);
      setConsultas(res.data.consultas);
      setConsultasTotal(res.data.total || 0);
    } catch (e) { console.error(e); }
  }, []);

  const loadStats = useCallback(async () => {
    const [s, m, l] = await Promise.all([
      adminAPI.getStats(),
      adminAPI.getMetricasRAG(),
      adminAPI.getLogs(100),
    ]);
    setStats(s.data);
    setMetricasRAG(m.data);
    setLogs(l.data.logs);
  }, []);

  const loadUsuarios = useCallback(async () => {
    const res = await adminAPI.getUsuarios({
      page: filterPage,
      limit: 25,
      ...(filterRol && { rol: filterRol }),
      ...(filterSearch && { search: filterSearch }),
    });
    setUsuarios(res.data.usuarios);
    setUsuariosTotal(res.data.total);
  }, [filterPage, filterRol, filterSearch]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const u = JSON.parse(userData);
    if (u.rol !== 'ADMINISTRADOR') { router.push('/dashboard'); return; }
    setUser(u);
    Promise.all([loadStats(), loadUsuarios(), loadConsultas(1)])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) loadUsuarios();
  }, [filterPage, filterRol, filterSearch]);

  useEffect(() => {
    if (user && (tab === 'consultas' || consultaPage > 1)) loadConsultas(consultaPage);
  }, [tab, consultaPage]);

  useEffect(() => {
    if (user && tab === 'alimentos') loadAlimentos(alimentoSearch, alimentoPage);
  }, [tab, alimentoSearch, alimentoPage]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadUsuarios(), loadConsultas(consultaPage)]);
    setRefreshing(false);
  };

  const handleToggleActivo = async (id, activo) => {
    try {
      await adminAPI.toggleUsuarioActivo(id, !activo);
      loadUsuarios();
    } catch {}
  };

  /* ── loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEF2F7]">
        <div className="text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
            <Shield size={28} className="text-white animate-pulse" />
          </div>
          <p className="text-slate-600 font-semibold">Cargando panel de administración</p>
          <div className="flex justify-center gap-1.5 mt-4">
            {[0,1,2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full bg-slate-400/40 animate-bounce" style={{ animationDelay: `${i*120}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const s = stats;
  const rag = metricasRAG;

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-6 overflow-x-hidden">

      {/* ═══════════ HEADER ═══════════ */}
      <div className="bg-gradient-to-r from-[#0057B8] to-[#7C3AED] px-5 pt-10 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')}
              className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition-all">
              <ChevronLeft size={16} className="text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-white/70" />
                <p className="text-white/70 text-xs font-semibold">Panel Admin</p>
              </div>
              <h1 className="text-white text-xl font-bold leading-tight">
                {user?.nombre_completo?.split(' ')[0] || 'Admin'} · NutriDiabetes
              </h1>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-xl border border-white/20 transition-all active:scale-95 disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ═══════════ TABS ═══════════ */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="flex overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-5 py-3.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
                tab === id
                  ? 'border-[#0057B8] text-[#0057B8] bg-blue-50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="px-4 space-y-5">

        {/* ─────────── TAB: RESUMEN ─────────── */}
        {tab === 'resumen' && (
          <>
            {/* KPIs usuarios */}
            <section>
              <SectionTitle>Usuarios</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard icon={Users}   label="Total usuarios"      value={fmt(s?.usuarios?.total)}        sub={`${fmt(s?.usuarios?.activos_30d)} activos (30d)`} color="blue"   />
                <KpiCard icon={Target}  label="Pacientes"           value={fmt(s?.usuarios?.total_pacientes)} sub={`${fmt(s?.usuarios?.nuevos_7d)} nuevos esta semana`} color="green" />
                <KpiCard icon={Activity} label="Nutricionistas"     value={fmt(s?.usuarios?.total_nutricionistas)} color="purple" />
                <KpiCard icon={Shield}  label="Nuevos hoy"          value={fmt(s?.usuarios?.nuevos_hoy)}   color="amber"  />
              </div>
            </section>

            {/* KPIs consultas IA */}
            <section>
              <SectionTitle>Consultas con IA</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard icon={MessageCircle} label="Total consultas"    value={fmt(s?.consultas?.total_conversaciones)} sub={`${fmt(s?.consultas?.hoy)} hoy`} color="blue" />
                <KpiCard icon={Zap}           label="Total tokens"       value={fmt(s?.tokens?.total_tokens)}  sub={`~${fmt(s?.tokens?.promedio_por_consulta)} por consulta`} color="purple" />
                <KpiCard icon={Clock}         label="Tiempo promedio"    value={fmtMs(s?.tiempos?.promedio_ms)} sub={`Máx: ${fmtMs(s?.tiempos?.max_ms)}`} color="amber" />
                <KpiCard icon={Star}          label="SUS Score"          value={s?.feedback?.sus_promedio ? `${s.feedback.sus_promedio}/100` : '—'} sub={`${fmt(s?.feedback?.total_evaluaciones)} evaluaciones`} color="green" />
              </div>
            </section>

            {/* KPIs DM2 */}
            <section>
              <SectionTitle>Pacientes por clasificación DM2</SectionTitle>
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(15,28,60,0.06)] divide-y divide-slate-100 overflow-hidden">
                {[
                  { key: 'controlada',         label: 'DM2 Controlada',          color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { key: 'no_controlada',      label: 'DM2 No controlada',        color: 'text-red-600',     bg: 'bg-red-50'     },
                  { key: 'sin_complicaciones', label: 'Sin complicaciones',        color: 'text-blue-600',    bg: 'bg-blue-50'    },
                  { key: 'con_complicaciones', label: 'Con complicaciones',        color: 'text-orange-600',  bg: 'bg-orange-50'  },
                  { key: 'pre_diabetes',       label: 'Pre-diabetes',             color: 'text-amber-600',   bg: 'bg-amber-50'   },
                ].map(row => (
                  <div key={row.key} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${row.bg.replace('bg-', 'bg-').replace('50', '400')}`} />
                      <p className="text-sm text-slate-600 font-medium">{row.label}</p>
                    </div>
                    <p className={`text-lg font-bold tabular-nums ${row.color}`}>
                      {fmt(s?.pacientes_dm2?.[row.key])}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Gráfico consultas por día */}
            {rag?.consultas_por_dia?.length > 0 && (
              <section>
                <SectionTitle>Consultas por día (30d)</SectionTitle>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(15,28,60,0.06)] p-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={rag.consultas_por_dia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: '#94A3B8' }}
                        tickFormatter={v => new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} />
                      <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
                        labelFormatter={v => fmtDate(v)}
                      />
                      <Bar dataKey="consultas" fill="#0057B8" radius={[4, 4, 0, 0]} name="Consultas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Gráfico tokens por día */}
            {rag?.tokens_por_dia?.length > 0 && (
              <section>
                <SectionTitle>Tokens por día (30d)</SectionTitle>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(15,28,60,0.06)] p-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={rag.tokens_por_dia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: '#94A3B8' }}
                        tickFormatter={v => new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} />
                      <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickFormatter={v => fmt(v)} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
                        labelFormatter={v => fmtDate(v)}
                        formatter={v => [fmt(v), 'Tokens']}
                      />
                      <Line type="monotone" dataKey="tokens" stroke="#7C3AED" strokeWidth={2} dot={false} name="Tokens" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Feedback */}
            {s?.feedback?.total_evaluaciones > 0 && (
              <section>
                <SectionTitle>Satisfacción del usuario</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard icon={Star}       label="Calificación promedio" value={`${s.feedback.calificacion_promedio}/5`} color="amber"  />
                  <KpiCard icon={TrendingUp} label="Relevancia promedio"   value={`${s.feedback.relevancia_promedio}/5`}  color="blue"   />
                  <KpiCard icon={CheckCircle2} label="Utilidad promedio"   value={`${s.feedback.utilidad_promedio}/5`}    color="green"  />
                  <KpiCard icon={Database}   label="Total evaluaciones"    value={fmt(s.feedback.total_evaluaciones)}     color="slate"  />
                </div>
              </section>
            )}
          </>
        )}

        {/* ─────────── TAB: PACIENTES ─────────── */}
        {tab === 'pacientes' && (
          <>
            {/* Filtros */}
            <section>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Buscar nombre o email..."
                  value={filterSearch}
                  onChange={e => { setFilterSearch(e.target.value); setFilterPage(1); }}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <select
                  value={filterRol}
                  onChange={e => { setFilterRol(e.target.value); setFilterPage(1); }}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">Todos los roles</option>
                  <option value="PACIENTE">Paciente</option>
                  <option value="NUTRICIONISTA">Nutricionista</option>
                  <option value="ADMINISTRADOR">Admin</option>
                </select>
              </div>
              <p className="text-xs text-slate-400 mt-2 px-1">{fmt(usuariosTotal)} usuarios encontrados</p>
            </section>

            {/* Tabla usuarios */}
            <section>
              <div className="space-y-2">
                {usuarios.map(u => (
                  <div key={u.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(15,28,60,0.06)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <span className="text-white font-bold text-sm">{(u.nombre_completo || u.email || '?')[0].toUpperCase()}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{u.nombre_completo || '(sin nombre)'}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <Badge label={u.rol} colorClass={ROL_COLORS[u.rol] || 'bg-slate-100 text-slate-700 border-slate-200'} />
                            {u.clasificacion_dm2 && (
                              <Badge
                                label={DM2_LABELS[u.clasificacion_dm2] || u.clasificacion_dm2}
                                colorClass={DM2_COLORS[u.clasificacion_dm2] || 'bg-slate-100 text-slate-700 border-slate-200'}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Toggle activo */}
                      <button
                        onClick={() => handleToggleActivo(u.id, u.activo)}
                        title={u.activo ? 'Desactivar' : 'Activar'}
                        className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                          u.activo
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-500 hover:bg-red-100'
                        }`}
                      >
                        {u.activo ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                      </button>
                    </div>

                    {/* Métricas del usuario */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Consultas</p>
                        <p className="text-sm font-bold text-[#0057B8] tabular-nums">{fmt(u.total_conversaciones)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tokens</p>
                        <p className="text-sm font-bold text-purple-600 tabular-nums">{fmt(u.total_tokens)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Último acceso</p>
                        <p className="text-xs font-semibold text-slate-500">{fmtRelative(u.ultimo_acceso)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400">Registro: {fmtDate(u.fecha_creacion)}</p>
                      {u.hemoglobina_glicosilada && (
                        <p className="text-[10px] text-slate-500 font-semibold">HbA1c: {u.hemoglobina_glicosilada}%</p>
                      )}
                    </div>
                  </div>
                ))}

                {usuarios.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No se encontraron usuarios</p>
                  </div>
                )}
              </div>

              <Pagination
                page={filterPage}
                total={usuariosTotal}
                limit={USUARIO_LIMIT}
                onChange={setFilterPage}
              />
            </section>
          </>
        )}

        {/* ─────────── TAB: ALIMENTOS ─────────── */}
        {tab === 'alimentos' && (
          <div className="space-y-5">

            {/* Formulario agregar */}
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-emerald-50">
                <Plus size={16} className="text-emerald-600" />
                <p className="font-bold text-emerald-800 text-sm">Agregar nuevo alimento</p>
                <span className="ml-auto text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  PostgreSQL + Pinecone
                </span>
              </div>

              <form onSubmit={handleCrearAlimento} className="p-5 space-y-4">
                {/* Fila 1: Nombre */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre TPCA *</label>
                    <input required value={form.nombre}
                      onChange={e => setForm(f => ({...f, nombre: e.target.value}))}
                      placeholder="ej. Quinua perlada cocida"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre común</label>
                    <input value={form.nombre_comun}
                      onChange={e => setForm(f => ({...f, nombre_comun: e.target.value}))}
                      placeholder="ej. Quinoa, quinua"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                </div>

                {/* Fila 2: Categoría + Recomendación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría *</label>
                    <select required value={form.categoria_id}
                      onChange={e => setForm(f => ({...f, categoria_id: e.target.value}))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                      {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Recomendación DM2</label>
                    <select value={form.nivel_recomendacion}
                      onChange={e => setForm(f => ({...f, nivel_recomendacion: e.target.value}))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                      <option value="RECOMENDADO">✅ Recomendado</option>
                      <option value="MODERADO">⚠️ Moderado</option>
                      <option value="LIMITAR">🔴 Limitar</option>
                    </select>
                  </div>
                </div>

                {/* Fila 3: Macros principales */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Composición por 100g</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { key: 'energia_kcal',            label: 'Energía (kcal)', placeholder: '351' },
                      { key: 'proteinas_g',              label: 'Proteínas (g)',  placeholder: '12.8' },
                      { key: 'carbohidratos_totales_g',  label: 'Carbs (g)',      placeholder: '69.1' },
                      { key: 'grasas_totales_g',         label: 'Grasas (g)',     placeholder: '6.6'  },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">{f.label}</label>
                        <input type="number" step="0.1" min="0" placeholder={f.placeholder}
                          value={form[f.key]}
                          onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fila 4: Micros + IG */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'fibra_dietaria_g', label: 'Fibra (g)',    placeholder: '9.3' },
                    { key: 'indice_glucemico', label: 'IG (0-100)',   placeholder: '35'  },
                    { key: 'calcio_mg',        label: 'Calcio (mg)',  placeholder: '236' },
                    { key: 'vitamina_c_mg',    label: 'Vit C (mg)',   placeholder: '1.3' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">{f.label}</label>
                      <input type="number" step="0.1" min="0" placeholder={f.placeholder}
                        value={form[f.key]}
                        onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                  ))}
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notas / fuente</label>
                  <input value={form.notas}
                    onChange={e => setForm(f => ({...f, notas: e.target.value}))}
                    placeholder="ej. INS/MINSA TPCA 2025, página 45"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>

                {/* Apto diabéticos */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.es_apto_diabeticos}
                    onChange={e => setForm(f => ({...f, es_apto_diabeticos: e.target.checked}))}
                    className="w-4 h-4 rounded accent-emerald-600" />
                  <span className="text-sm font-medium text-slate-700">Apto para diabéticos</span>
                </label>

                {/* Mensaje */}
                {guardadoMsg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${guardadoMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {guardadoMsg.texto}
                  </div>
                )}

                <button type="submit" disabled={guardando}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Plus size={16} />
                  {guardando ? 'Guardando...' : 'Agregar a PostgreSQL + Pinecone'}
                </button>
              </form>
            </section>

            {/* Lista alimentos existentes */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {alimentosTotal} alimentos en BD
                </p>
                <input
                  placeholder="Buscar..."
                  value={alimentoSearch}
                  onChange={e => { setAlimentoSearch(e.target.value); setAlimentoPage(1); }}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 w-40"
                />
              </div>

              <div className="space-y-2">
                {alimentos.map(a => (
                  <div key={a.id} className="bg-white rounded-xl border border-slate-200/60 shadow-sm px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Leaf size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.nombre_comun || a.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-400">{a.categoria}</span>
                        {a.energia_kcal && <span className="text-[10px] font-medium text-blue-600">{a.energia_kcal} kcal</span>}
                        {a.indice_glucemico && <span className="text-[10px] font-medium text-orange-600">IG {a.indice_glucemico}</span>}
                        {a.embedding_generado && (
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold">📍 Pinecone</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEliminarAlimento(a.id, a.nombre_comun || a.nombre)}
                      className="p-2 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {alimentos.length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    <UtensilsCrossed size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sin alimentos registrados</p>
                  </div>
                )}
              </div>

              <Pagination
                page={alimentoPage}
                total={alimentosTotal}
                limit={ALIMENTO_LIMIT}
                onChange={(p) => { setAlimentoPage(p); }}
              />
            </section>
          </div>
        )}

        {/* ─────────── TAB: MÉTRICAS RAG ─────────── */}
        {tab === 'rag' && (
          <>
            {/* Tiempos globales */}
            <section>
              <SectionTitle>Tiempos de respuesta RAG</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard icon={Clock}      label="Promedio"         value={fmtMs(rag?.tiempos_respuesta?.promedio_ms)} color="blue"   />
                <KpiCard icon={TrendingUp} label="Máximo"           value={fmtMs(rag?.tiempos_respuesta?.max_ms)}    color="red"    />
                <KpiCard icon={Target}     label="Mínimo"           value={fmtMs(rag?.tiempos_respuesta?.min_ms)}    color="green"  />
                <KpiCard icon={Eye}        label="Similitud coseno" value={rag?.tiempos_respuesta?.similitud_promedio ?? '—'} color="purple" />
              </div>
            </section>

            {/* Tabla métricas por tipo */}
            <section>
              <SectionTitle>Métricas del pipeline RAG</SectionTitle>
              <div className="space-y-2">
                {(rag?.metricas_rag || []).length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center text-slate-400">
                    <Brain size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sin métricas registradas aún</p>
                    <p className="text-xs mt-1">Se poblarán cuando el sistema procese consultas RAG</p>
                  </div>
                )}
                {(rag?.metricas_rag || []).map((m, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(15,28,60,0.06)] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-slate-800">{m.tipo_metrica}</p>
                      {m.modelo_llm && (
                        <Badge label={m.modelo_llm} colorClass="bg-purple-50 text-purple-700 border-purple-200" />
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: 'Promedio', value: m.promedio },
                        { label: 'Mín',      value: m.minimo   },
                        { label: 'Máx',      value: m.maximo   },
                        { label: 'σ',        value: m.desviacion, title: 'Desviación estándar' },
                      ].map(cell => (
                        <div key={cell.label}>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{cell.label}</p>
                          <p className="text-sm font-bold text-slate-700 tabular-nums" title={cell.title}>
                            {cell.value ?? '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 text-right">{fmt(m.total_mediciones)} mediciones</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Gráfico tokens por día */}
            {rag?.tokens_por_dia?.length > 0 && (
              <section>
                <SectionTitle>Tiempo de respuesta por día (ms)</SectionTitle>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(15,28,60,0.06)] p-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={rag.tokens_por_dia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: '#94A3B8' }}
                        tickFormatter={v => new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} />
                      <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickFormatter={v => `${v}ms`} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
                        labelFormatter={v => fmtDate(v)}
                        formatter={v => [`${v}ms`, 'Tiempo prom.']}
                      />
                      <Line type="monotone" dataKey="tiempo_promedio_ms" stroke="#F59E0B" strokeWidth={2} dot={false} name="ms" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </>
        )}

        {/* ─────────── TAB: CONSULTAS ─────────── */}
        {tab === 'consultas' && (
          <section>
            <SectionTitle>Últimas 50 consultas</SectionTitle>
            <div className="space-y-2">
              {consultas.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(15,28,60,0.06)] p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{c.titulo || '(sin título)'}</p>
                      <p className="text-xs text-slate-400">{c.nombre_completo || c.email}</p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <Badge
                        label={c.estado}
                        colorClass={c.estado === 'ACTIVA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mensajes</p>
                      <p className="text-sm font-bold text-[#0057B8] tabular-nums">{fmt(c.total_mensajes)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tokens</p>
                      <p className="text-sm font-bold text-purple-600 tabular-nums">{fmt(c.tokens_totales)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tiempo prom.</p>
                      <p className="text-sm font-bold text-amber-600">{fmtMs(c.tiempo_promedio_ms)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Similitud</p>
                      <p className="text-sm font-bold text-emerald-600 tabular-nums">{c.similitud_promedio ?? '—'}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">{fmtDate(c.fecha_creacion)}</p>
                </div>
              ))}

              {consultas.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin consultas registradas</p>
                </div>
              )}
            </div>
            <Pagination
              page={consultaPage}
              total={consultasTotal}
              limit={CONSULTA_LIMIT}
              onChange={setConsultaPage}
            />
          </section>
        )}

        {/* ─────────── TAB: LOGS ─────────── */}
        {tab === 'logs' && (
          <section>
            <SectionTitle>Últimos 100 registros de actividad</SectionTitle>
            <div className="space-y-2">
              {logs.map(l => (
                <div key={l.id} className="bg-white rounded-xl border border-slate-200/60 shadow-[0_1px_4px_rgba(15,28,60,0.06)] px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-slate-700">{l.accion}</p>
                      {l.entidad && <Badge label={l.entidad} colorClass="bg-slate-100 text-slate-600 border-slate-200" />}
                      <Badge label={l.rol} colorClass={ROL_COLORS[l.rol] || 'bg-slate-100 text-slate-600 border-slate-200'} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{l.nombre_completo || l.email}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] text-slate-400">{fmtRelative(l.fecha_creacion)}</p>
                    {l.ip_address && <p className="text-[9px] text-slate-300 mt-0.5">{l.ip_address}</p>}
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin logs registrados</p>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
