'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardAPI } from '@/lib/api';
import { NavBar } from '@/components';
import {
  MessageCircle, Droplet, UtensilsCrossed, User,
  TrendingUp, Target, Flame, BarChart3, Activity,
  LogOut, ChevronRight, CheckCircle2, AlertCircle,
} from 'lucide-react';

/* ── helpers ──────────────────────────────────────── */
/* Rangos ADA 2020 para DM2 — usa tipo de medición si está disponible */
function getGlucoseStatus(val, tipo = 'AYUNAS') {
  if (!val) return { label: 'Sin datos', color: 'slate', icon: null, ring: '#94A3B8' };
  const v = parseFloat(val);
  if (v < 70) return { label: 'Hipoglucemia', color: 'red', icon: AlertCircle, ring: '#EF4444' };

  const POST   = ['POST_PRANDIAL_1H', 'POST_PRANDIAL_2H'].includes(tipo);
  const DORMIR = tipo === 'ANTES_DORMIR';

  if (POST) {
    if (v <= 180) return { label: 'En rango',   color: 'emerald', icon: CheckCircle2, ring: '#10B981' };
    if (v <= 250) return { label: 'Elevada',     color: 'amber',   icon: AlertCircle,  ring: '#F59E0B' };
    return         { label: 'Muy elevada',       color: 'red',     icon: AlertCircle,  ring: '#EF4444' };
  }
  if (DORMIR) {
    if (v <= 150) return { label: 'En rango',   color: 'emerald', icon: CheckCircle2, ring: '#10B981' };
    if (v <= 200) return { label: 'Elevada',     color: 'amber',   icon: AlertCircle,  ring: '#F59E0B' };
    return         { label: 'Muy elevada',       color: 'red',     icon: AlertCircle,  ring: '#EF4444' };
  }
  /* Ayunas / Pre-prandial — meta ADA DM2: 80–130 */
  if (v < 80)   return { label: 'Bajo en rango', color: 'amber',   icon: AlertCircle,  ring: '#F59E0B' };
  if (v <= 130) return { label: 'En rango',      color: 'emerald', icon: CheckCircle2, ring: '#10B981' };
  if (v <= 180) return { label: 'Elevada',        color: 'amber',   icon: AlertCircle,  ring: '#F59E0B' };
  return         { label: 'Muy elevada',          color: 'red',     icon: AlertCircle,  ring: '#EF4444' };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDate() {
  return new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ── action cards config ──────────────────────────── */
const ACTIONS = [
  { icon: MessageCircle, title: 'Chat Nutricional', desc: 'Consulta con IA',    href: '/chat',      gradient: 'from-[#0057B8] to-[#003D82]', shadow: 'rgba(0,87,184,0.35)' },
  { icon: Droplet,       title: 'Registrar Glucosa', desc: 'Nueva medición',    href: '/glucosa',   gradient: 'from-[#059669] to-[#047857]', shadow: 'rgba(5,150,105,0.35)' },
  { icon: UtensilsCrossed, title: 'Alimentos',       desc: 'Tabla nutricional', href: '/alimentos', gradient: 'from-[#D97706] to-[#B45309]', shadow: 'rgba(217,119,6,0.35)' },
  { icon: User,          title: 'Perfil Clínico',    desc: 'Datos de salud',    href: '/perfil',    gradient: 'from-[#7C3AED] to-[#5B21B6]', shadow: 'rgba(124,58,237,0.35)' },
];

/* ── component ────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser]           = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    setUser(JSON.parse(userData));
    dashboardAPI.get()
      .then(res => setDashboard(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  /* ── loading screen ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEF2F7]">
        <div className="text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#0057B8] to-[#003D82] flex items-center justify-center shadow-[0_8px_24px_rgba(0,87,184,0.4)]">
            <Activity size={28} className="text-white animate-pulse" />
          </div>
          <p className="text-slate-600 font-semibold">Cargando tu panel de salud</p>
          <div className="flex justify-center gap-1.5 mt-4">
            {[0,1,2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full bg-[#0057B8]/25 animate-bounce" style={{ animationDelay: `${i*120}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const glucosa   = dashboard?.glucosa;
  const nutricion = dashboard?.nutricion;
  const actividad = dashboard?.actividad;
  const glucVal   = glucosa?.ultima?.valor_mg_dl;
  const glucType  = glucosa?.ultima?.tipo_medicion?.replace(/_/g, ' ') || 'Sin mediciones';
  const status    = getGlucoseStatus(glucVal, glucosa?.ultima?.tipo_medicion);
  const StatusIcon = status.icon;

  const ringColor = {
    emerald: 'border-emerald-400 bg-emerald-50',
    amber:   'border-amber-400 bg-amber-50',
    red:     'border-red-400 bg-red-50',
    slate:   'border-slate-300 bg-slate-50',
  };
  const badgeColor = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    red:     'bg-red-50 text-red-600 border-red-200',
    slate:   'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <div className="page-with-nav min-h-screen bg-[#EEF2F7] pb-24 overflow-x-hidden">

      {/* ═══════════════════════════════════════════
          HEADER — app-style gradient hero
      ═══════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-[#0057B8] via-[#0052AD] to-[#003D82] relative overflow-hidden">
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.9) 1px,transparent 1px)', backgroundSize:'20px 20px' }} />
        {/* Glow blob */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl" />

        <div className="relative px-5 pt-8 pb-20">
          <div className="flex items-start justify-between">
            {/* Greeting */}
            <div>
              <p className="text-blue-200/70 text-sm font-medium capitalize">{getGreeting()}</p>
              <h1 className="text-white text-3xl font-bold mt-0.5 tracking-tight">
                {user?.nombre?.split(' ')[0] || 'Paciente'}
              </h1>
              <p className="text-blue-200/60 text-xs mt-1.5 capitalize">{formatDate()}</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => router.push('/chat')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/22 text-white text-sm font-medium rounded-xl border border-white/20 backdrop-blur-sm transition-all active:scale-95"
              >
                <MessageCircle size={15} />
                <span className="hidden sm:inline">Chat IA</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-xl border border-white/15 transition-all active:scale-95"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          CONTENT — overlaps header
      ═══════════════════════════════════════════ */}
      <div className="-mt-8 px-4 space-y-5">

        {/* ── Glucosa Hero Card ── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(15,28,60,0.12)] border border-slate-200/60 overflow-hidden animate-slide-up">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              {/* Number */}
              <div className="flex-1 min-w-0">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Última glucosa</p>
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-bold text-slate-900 tracking-tight leading-none tabular-nums">
                    {glucVal ?? '--'}
                  </span>
                  {glucVal && <span className="text-slate-400 text-base font-medium mb-1.5">mg/dL</span>}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${badgeColor[status.color]}`}>
                    {StatusIcon && <StatusIcon size={11} />}
                    {status.label}
                  </span>
                  <span className="text-slate-400 text-xs capitalize">{glucType}</span>
                </div>
              </div>

              {/* Status ring */}
              <div className={`w-16 h-16 rounded-full border-4 ${ringColor[status.color]} flex items-center justify-center flex-shrink-0`}>
                {StatusIcon
                  ? <StatusIcon size={22} className={`text-${status.color}-500`} />
                  : <BarChart3 size={20} className="text-slate-300" />
                }
              </div>
            </div>
          </div>

          {/* Stats row */}
          {glucosa?.promedio7d?.promedio ? (
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
              <div className="px-4 py-3 flex items-center gap-2.5">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={13} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Promedio 7d</p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    {glucosa.promedio7d.promedio} <span className="text-xs font-normal text-slate-400">mg/dL</span>
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 flex items-center gap-2.5">
                <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target size={13} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">En rango</p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    {glucosa.promedio7d.mediciones || 0} <span className="text-xs font-normal text-slate-400">mediciones</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">Registra tu primera medición</p>
              <button onClick={() => router.push('/glucosa')} className="text-xs font-semibold text-[#0057B8] hover:underline flex items-center gap-1">
                Registrar <ChevronRight size={11} />
              </button>
            </div>
          )}
        </div>

        {/* ── Acciones rápidas ── */}
        <section className="animate-slide-up stagger-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Acciones rápidas</p>
          <div className="grid grid-cols-2 gap-3">
            {ACTIONS.map(({ icon: Icon, title, desc, href, gradient, shadow }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`relative bg-gradient-to-br ${gradient} rounded-2xl p-5 text-left text-white shadow-lg active:scale-[0.97] transition-all duration-200 group overflow-hidden`}
                style={{ boxShadow: `0 4px 16px ${shadow}` }}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Icon size={20} />
                  </div>
                  <p className="font-bold text-[15px] leading-tight">{title}</p>
                  <p className="text-white/65 text-xs mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Nutrición de hoy ── */}
        <section className="animate-slide-up stagger-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Nutrición de hoy</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Flame,    label: 'Calorías', value: Math.round(nutricion?.hoy?.calorias || 0),         unit: 'kcal',  from: '#D97706', to: '#B45309', bg: 'bg-amber-50',  text: 'text-amber-600',  iconBg: 'bg-amber-100' },
              { icon: BarChart3, label: 'Carbs',   value: Math.round(nutricion?.hoy?.carbohidratos_g || 0), unit: 'g',     from: '#0057B8', to: '#003D82', bg: 'bg-blue-50',   text: 'text-blue-600',   iconBg: 'bg-blue-100'  },
              { icon: Activity,  label: 'Proteínas',value: Math.round(nutricion?.hoy?.proteinas_g || 0),    unit: 'g',     from: '#059669', to: '#047857', bg: 'bg-emerald-50',text: 'text-emerald-600',iconBg: 'bg-emerald-100'},
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-2xl p-4 border border-white shadow-[0_2px_8px_rgba(15,28,60,0.06)] text-center`}>
                <div className={`w-9 h-9 ${s.iconBg} rounded-xl flex items-center justify-center mx-auto mb-2.5`}>
                  <s.icon size={17} className={s.text} />
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{s.label}</p>
                <p className={`text-2xl font-bold ${s.text} mt-1 leading-none tabular-nums`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{s.unit}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Última Recomendación IA ── */}
        {actividad?.ultimaRecomendacion && (
          <section className="animate-slide-up stagger-3">
            <div className="bg-gradient-to-br from-[#0057B8]/5 to-[#7C3AED]/5 border border-[#0057B8]/15 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-[#0057B8] to-[#7C3AED] rounded-lg flex items-center justify-center">
                  <Activity size={13} className="text-white" />
                </div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Última recomendación IA</p>
              </div>
              <p className="text-slate-700 font-semibold text-sm leading-snug mb-3">{actividad.ultimaRecomendacion.titulo}</p>
              <div className="flex flex-wrap gap-2">
                {actividad.ultimaRecomendacion.calorias_totales && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200/80 text-amber-700 text-xs font-semibold rounded-lg">
                    <Flame size={11} /> {Math.round(actividad.ultimaRecomendacion.calorias_totales)} kcal
                  </span>
                )}
                {actividad.ultimaRecomendacion.indice_glucemico_estimado && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold rounded-lg">
                    <BarChart3 size={11} /> IG: {actividad.ultimaRecomendacion.indice_glucemico_estimado}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Resumen de actividad ── */}
        <section className="animate-slide-up stagger-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Resumen de actividad</p>
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(15,28,60,0.06)] divide-y divide-slate-100 overflow-hidden">
            {[
              { label: 'Consultas con IA',   value: actividad?.totalConsultas || 0,         icon: MessageCircle, iconBg: 'bg-blue-50',   iconColor: 'text-blue-600',   valColor: 'text-blue-600'   },
              { label: 'Mediciones (7 días)', value: glucosa?.promedio7d?.mediciones || 0,   icon: Droplet,       iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', valColor: 'text-emerald-600' },
              { label: 'Comidas registradas', value: nutricion?.hoy?.comidas || 0,            icon: UtensilsCrossed, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', valColor: 'text-purple-600'  },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${row.iconBg} rounded-xl flex items-center justify-center`}>
                    <row.icon size={15} className={row.iconColor} />
                  </div>
                  <p className="text-sm text-slate-600 font-medium">{row.label}</p>
                </div>
                <p className={`text-xl font-bold tabular-nums ${row.valColor}`}>{row.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Spacer for NavBar */}
        <div className="h-2" />
      </div>

      <NavBar />
    </div>
  );
}
