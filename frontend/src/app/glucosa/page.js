'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { glucosaAPI } from '@/lib/api';
import { Header, FormField, Tabs, GlucoseChart, Badge, NavBar, Button } from '@/components';
import {
  AlertCircle, Check, Download, Activity,
  TrendingUp, TrendingDown, Target, BarChart3, Droplet,
} from 'lucide-react';

const TIPOS_MEDICION = [
  { value: 'AYUNAS',           label: 'En ayunas',        desc: 'Antes del desayuno' },
  { value: 'PRE_PRANDIAL',     label: 'Pre-prandial',     desc: 'Antes de comer'     },
  { value: 'POST_PRANDIAL_1H', label: 'Post 1h',          desc: '1 hora después'     },
  { value: 'POST_PRANDIAL_2H', label: 'Post 2h',          desc: '2 horas después'    },
  { value: 'ANTES_DORMIR',     label: 'Antes de dormir',  desc: 'Nocturna'           },
  { value: 'ALEATORIA',        label: 'Aleatoria',        desc: 'Cualquier momento'  },
];

/* ─── Rangos ADA 2020 para DM2 ─── */
function getGlucoseStatus(val, tipoMedicion = 'AYUNAS') {
  const v = parseFloat(val);
  if (isNaN(v)) return { color: 'gray',   label: 'Sin dato',          desc: '',                                      severity: 0 };
  if (v < 54)   return { color: 'red',    label: 'Hipoglucemia grave', desc: 'Requiere atención inmediata',           severity: 4 };
  if (v < 70)   return { color: 'red',    label: 'Hipoglucemia',       desc: 'Nivel peligrosamente bajo',             severity: 3 };
  const POST   = ['POST_PRANDIAL_1H', 'POST_PRANDIAL_2H'].includes(tipoMedicion);
  const DORMIR = tipoMedicion === 'ANTES_DORMIR';
  const RANDOM = tipoMedicion === 'ALEATORIA';
  if (POST) {
    if (v <= 180) return { color: 'green',  label: 'En rango',    desc: 'Meta post-prandial ADA: < 180 mg/dL',  severity: 0 };
    if (v <= 250) return { color: 'orange', label: 'Elevada',     desc: 'Por encima de meta post-prandial',      severity: 1 };
    return         { color: 'red',    label: 'Muy elevada', desc: 'Consulta a tu médico',                  severity: 2 };
  }
  if (DORMIR) {
    if (v <= 150) return { color: 'green',  label: 'En rango',    desc: 'Meta nocturna ADA: 90–150 mg/dL',      severity: 0 };
    if (v <= 200) return { color: 'orange', label: 'Elevada',     desc: 'Por encima de meta nocturna',           severity: 1 };
    return         { color: 'red',    label: 'Muy elevada', desc: 'Consulta a tu médico',                  severity: 2 };
  }
  if (RANDOM) {
    if (v < 140)  return { color: 'green',  label: 'Normal',      desc: '< 140 mg/dL aleatoria',                severity: 0 };
    if (v < 200)  return { color: 'orange', label: 'Elevada',     desc: '140–199 mg/dL',                         severity: 1 };
    return         { color: 'red',    label: 'Muy elevada', desc: '≥ 200 mg/dL — posible hiperglucemia',   severity: 2 };
  }
  if (v < 80)   return { color: 'orange', label: 'Bajo en rango', desc: 'Meta ayunas: 80–130 mg/dL (ADA)',      severity: 1 };
  if (v <= 130) return { color: 'green',  label: 'En rango',      desc: 'Meta ayunas ADA DM2: 80–130 mg/dL',   severity: 0 };
  if (v <= 180) return { color: 'orange', label: 'Elevada',       desc: 'Por encima de meta en ayunas',         severity: 1 };
  return         { color: 'red',    label: 'Muy elevada',   desc: 'Consulta a tu médico',                  severity: 2 };
}

/* ─── Badge helper ─── */
function StatusBadge({ color, label }) {
  const cls = {
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    orange: 'bg-amber-50   text-amber-700   border-amber-200',
    red:    'bg-red-50     text-red-600     border-red-200',
    gray:   'bg-slate-100  text-slate-500   border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls[color] || cls.gray}`}>
      {label}
    </span>
  );
}

export default function GlucosaPage() {
  const router = useRouter();
  const [valor, setValor]     = useState('');
  const [tipo, setTipo]       = useState('AYUNAS');
  const [notas, setNotas]     = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');
  const [historial, setHistorial] = useState([]);
  const [stats, setStats]     = useState(null);
  const [tab, setTab]         = useState('registrar');

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    loadHistorial();
  }, []);

  const loadHistorial = async () => {
    try {
      const res = await glucosaAPI.getHistorial(90); // 90 días para mejor análisis
      setHistorial(res.data.registros || []);
      setStats(res.data.estadisticas);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valor || !tipo) return;
    setLoading(true); setError('');
    try {
      await glucosaAPI.registrar({ valor_mg_dl: parseFloat(valor), tipo_medicion: tipo, notas: notas || null });
      setSuccess(true); setValor(''); setNotas('');
      loadHistorial();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar la medición';
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } finally { setLoading(false); }
  };

  /* ─── Analytics (useMemo) ─── */
  const analytics = useMemo(() => {
    if (!historial.length) return null;
    const vals = historial.map(r => parseFloat(r.valor_mg_dl));
    const avg  = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const eHbA1c = ((avg + 46.7) / 28.7).toFixed(1);
    const total  = historial.length;
    const tir    = Math.round((historial.filter(r => r.valor_mg_dl >= 70 && r.valor_mg_dl <= 180).length / total) * 100);
    const tar    = Math.round((historial.filter(r => r.valor_mg_dl > 180).length / total) * 100);
    const tbr    = Math.round((historial.filter(r => r.valor_mg_dl < 70).length / total) * 100);
    const min    = Math.min(...vals);
    const max    = Math.max(...vals);

    // Agrupación por día para gráfico de tendencia
    const byDay = {};
    historial.forEach(r => {
      const d = new Date(r.fecha_medicion);
      const key = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
      if (!byDay[key]) byDay[key] = { key, vals: [], date: d };
      byDay[key].vals.push(parseFloat(r.valor_mg_dl));
    });
    const trendData = Object.values(byDay)
      .sort((a, b) => a.date - b.date)
      .slice(-14)
      .map(d => ({
        name: d.key,
        promedio: Math.round(d.vals.reduce((a, b) => a + b, 0) / d.vals.length),
        meta: 105,
      }));

    // Distribución por tipo de medición
    const porTipo = {};
    historial.forEach(r => {
      porTipo[r.tipo_medicion] = (porTipo[r.tipo_medicion] || 0) + 1;
    });

    // Interpretación clínica de eHbA1c
    const hba1c = parseFloat(eHbA1c);
    const hba1cInterp = hba1c < 5.7  ? { label: 'Normal', color: 'emerald' }
                      : hba1c < 6.5  ? { label: 'Prediabetes', color: 'amber' }
                      : hba1c < 7.0  ? { label: 'DM2 Controlada (ADA)', color: 'blue' }
                      : hba1c < 8.0  ? { label: 'DM2 Moderada', color: 'orange' }
                      :                { label: 'DM2 No controlada', color: 'red' };

    return { avg, eHbA1c, tir, tar, tbr, min, max, total, trendData, porTipo, hba1cInterp };
  }, [historial]);

  /* ─── Export CSV ─── */
  const exportCSV = () => {
    const BOM  = '﻿'; // para Excel en español
    const cols = ['Fecha', 'Hora', 'Valor (mg/dL)', 'Tipo de Medición', 'Estado', 'En Rango', 'Notas'];
    const rows = historial.map(reg => {
      const d  = new Date(reg.fecha_medicion);
      const st = getGlucoseStatus(reg.valor_mg_dl, reg.tipo_medicion);
      const tipoLabel = TIPOS_MEDICION.find(t => t.value === reg.tipo_medicion)?.label || reg.tipo_medicion;
      return [
        d.toLocaleDateString('es-PE'),
        d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        reg.valor_mg_dl,
        tipoLabel,
        st.label,
        reg.esta_en_rango ? 'Sí' : 'No',
        (reg.notas || '').replace(/,/g, ';'),
      ].join(',');
    });
    const csv  = BOM + [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `glucosa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const status   = valor ? getGlucoseStatus(parseFloat(valor), tipo) : null;
  const chartData = historial.slice(0, 7).reverse().map(reg => ({
    name:   new Date(reg.fecha_medicion).toLocaleDateString('es-PE', { weekday: 'short' }).slice(0, 3),
    glucosa: reg.valor_mg_dl,
    meta:   115,
  }));

  return (
    <div className="page-with-nav min-h-screen bg-[#EEF2F7] pb-32">
      <Header title="Control de Glucosa" subtitle="Registra, historial y tendencias" variant="blue" showChat={false} showLogout={true} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 relative z-10">
        <Tabs
          tabs={[
            { id: 'registrar',  label: 'Registrar'  },
            { id: 'historial',  label: 'Historial'  },
            { id: 'tendencias', label: 'Tendencias' },
          ]}
          activeTab={tab}
          onChange={setTab}
        />

        {/* ══════════════ TAB: REGISTRAR ══════════════ */}
        {tab === 'registrar' && (
          <div className="space-y-5 animate-fade-in">
            {/* Mini stats */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Promedio',       value: stats.promedio,   unit: 'mg/dL', color: 'text-blue-600',    bg: 'bg-blue-50'    },
                  { label: 'En rango',       value: stats.en_rango || 0,  unit: 'medic.',  color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Fuera de rango', value: stats.fuera_rango || 0, unit: 'medic.',  color: 'text-red-500',    bg: 'bg-red-50'     },
                ].map((s, i) => (
                  <div key={i} className={`${s.bg} rounded-xl p-3 text-center border border-white`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
                    <p className="text-[10px] text-slate-400">{s.unit}</p>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200/80 rounded-xl p-4 flex items-start gap-3 animate-slide-down">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div><p className="font-semibold text-red-800 text-sm">Error al registrar</p><p className="text-sm text-red-600 mt-0.5">{error}</p></div>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3 animate-slide-down">
                <Check size={18} className="text-emerald-600 flex-shrink-0" />
                <div><p className="font-semibold text-emerald-900 text-sm">¡Registrado!</p><p className="text-sm text-emerald-700">Medición guardada en tu historial</p></div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-soft border border-slate-200/60 p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Valor */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Valor de Glucosa</label>
                  <div className="relative">
                    <input
                      type="number" value={valor} onChange={e => setValor(e.target.value)}
                      className="w-full px-6 py-4 text-center text-5xl font-bold rounded-2xl border-2 border-slate-200 focus:border-[#0057B8] focus:ring-2 focus:ring-blue-100 outline-none tabular-nums"
                      placeholder="120" min="20" max="600" required
                    />
                    <span className="absolute right-5 bottom-4 text-sm text-slate-400 font-medium">mg/dL</span>
                  </div>
                  {status && (
                    <div className={`mt-3 p-3.5 rounded-xl flex items-start gap-3 ${
                      status.color === 'green'  ? 'bg-emerald-50 border border-emerald-200/80' :
                      status.color === 'orange' ? 'bg-amber-50   border border-amber-200/80'   :
                      status.color === 'red'    ? 'bg-red-50     border border-red-200/80'     :
                                                  'bg-slate-100  border border-slate-200'
                    }`}>
                      <span className={`text-lg flex-shrink-0 ${status.color === 'green' ? 'text-emerald-500' : status.color === 'orange' ? 'text-amber-500' : 'text-red-500'}`}>
                        {status.severity === 0 ? '✓' : status.severity >= 3 ? '⚠' : '↑'}
                      </span>
                      <div>
                        <p className={`font-bold text-sm ${status.color === 'green' ? 'text-emerald-800' : status.color === 'orange' ? 'text-amber-800' : 'text-red-800'}`}>{status.label}</p>
                        <p className={`text-xs mt-0.5 ${status.color === 'green' ? 'text-emerald-600' : status.color === 'orange' ? 'text-amber-600' : 'text-red-600'}`}>{status.desc}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tipo medición */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Medición</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TIPOS_MEDICION.map(t => (
                      <button key={t.value} type="button" onClick={() => setTipo(t.value)}
                        className={`p-3 rounded-xl text-left text-sm font-medium transition-all border-2 ${
                          tipo === t.value ? 'border-[#0057B8] bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}>
                        <p className="font-semibold text-sm">{t.label}</p>
                        <p className="text-xs opacity-60 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <FormField label="Notas (Opcional)" type="text" placeholder="Ej: Después del almuerzo, sentía cansancio" value={notas} onChange={e => setNotas(e.target.value)} />

                <Button fullWidth size="lg" loading={loading} disabled={!valor} onClick={handleSubmit} variant="primary">
                  Registrar Medición
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════ TAB: HISTORIAL ══════════════ */}
        {tab === 'historial' && (
          <div className="space-y-5 animate-fade-in">
            {chartData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-200/60 p-5">
                <p className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Últimos 7 días</p>
                <GlucoseChart data={chartData} type="line" height={240} />
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-soft border border-slate-200/60 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="font-bold text-slate-700 text-sm">Historial de mediciones</p>
                {historial.length > 0 && (
                  <button onClick={exportCSV}
                    className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200/80 transition-all active:scale-95">
                    <Download size={13} /> Exportar CSV
                  </button>
                )}
              </div>

              {historial.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <Droplet size={40} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Sin registros aún</p>
                  <p className="text-sm text-slate-400 mt-1">Comienza registrando tu primera medición</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {historial.map(reg => {
                    const st   = getGlucoseStatus(reg.valor_mg_dl, reg.tipo_medicion);
                    const date = new Date(reg.fecha_medicion);
                    return (
                      <div key={reg.id} className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${st.color === 'green' ? 'bg-emerald-400' : st.color === 'orange' ? 'bg-amber-400' : 'bg-red-400'}`} />
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{reg.valor_mg_dl}</span>
                                <span className="text-xs text-slate-400 font-medium">mg/dL</span>
                                <StatusBadge color={st.color} label={st.label} />
                              </div>
                              <p className="text-xs text-slate-500 mt-1 truncate">
                                {TIPOS_MEDICION.find(t => t.value === reg.tipo_medicion)?.label || reg.tipo_medicion}
                                {reg.notas && <span className="ml-2 italic opacity-70">· {reg.notas}</span>}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-400 flex-shrink-0">
                            <p className="font-semibold text-slate-600">{date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</p>
                            <p>{date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ TAB: TENDENCIAS ══════════════ */}
        {tab === 'tendencias' && (
          <div className="space-y-5 animate-fade-in">
            {!analytics ? (
              <div className="text-center py-20">
                <BarChart3 size={40} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Sin datos suficientes</p>
                <p className="text-sm text-slate-400 mt-1">Registra al menos una medición para ver tus tendencias</p>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* eHbA1c */}
                  <div className={`rounded-2xl p-4 border text-center ${
                    analytics.hba1cInterp.color === 'emerald' ? 'bg-emerald-50 border-emerald-200/80' :
                    analytics.hba1cInterp.color === 'blue'    ? 'bg-blue-50   border-blue-200/80'    :
                    analytics.hba1cInterp.color === 'amber'   ? 'bg-amber-50  border-amber-200/80'   :
                    analytics.hba1cInterp.color === 'orange'  ? 'bg-orange-50 border-orange-200/80'  :
                                                                'bg-red-50     border-red-200/80'
                  }`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">HbA1c est.</p>
                    <p className={`text-4xl font-bold mt-1 tabular-nums ${
                      analytics.hba1cInterp.color === 'emerald' ? 'text-emerald-600' :
                      analytics.hba1cInterp.color === 'blue'    ? 'text-blue-600'    :
                      analytics.hba1cInterp.color === 'amber'   ? 'text-amber-600'   :
                      analytics.hba1cInterp.color === 'orange'  ? 'text-orange-600'  :
                                                                   'text-red-600'
                    }`}>{analytics.eHbA1c}<span className="text-lg">%</span></p>
                    <p className={`text-[10px] mt-1 font-semibold ${
                      analytics.hba1cInterp.color === 'emerald' ? 'text-emerald-600' : analytics.hba1cInterp.color === 'blue' ? 'text-blue-600' : 'text-orange-600'
                    }`}>{analytics.hba1cInterp.label}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Fórmula Nathan ADA</p>
                  </div>

                  {/* TIR */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tiempo en Rango</p>
                    <p className={`text-4xl font-bold mt-1 tabular-nums ${analytics.tir >= 70 ? 'text-emerald-600' : analytics.tir >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {analytics.tir}<span className="text-lg">%</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Meta ADA: ≥ 70%</p>
                    <p className="text-[10px] text-slate-400">70–180 mg/dL</p>
                  </div>

                  {/* Promedio */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Promedio</p>
                    <p className="text-4xl font-bold mt-1 text-slate-900 tabular-nums">{analytics.avg}</p>
                    <p className="text-[10px] text-slate-400 mt-1">mg/dL</p>
                    <p className="text-[10px] text-slate-400">Min {analytics.min} · Máx {analytics.max}</p>
                  </div>

                  {/* Total */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mediciones</p>
                    <p className="text-4xl font-bold mt-1 text-slate-900 tabular-nums">{analytics.total}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Últimos 90 días</p>
                  </div>
                </div>

                {/* TIR / TAR / TBR barras */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-slate-700">Distribución del tiempo</p>
                    <p className="text-xs text-slate-400">Estándar ADA / Ambulatory Glucose Profile</p>
                  </div>

                  {/* Barra visual combinada */}
                  <div className="h-6 w-full rounded-full overflow-hidden flex mb-4 gap-0.5">
                    {analytics.tbr > 0 && <div className="bg-red-400 rounded-l-full flex items-center justify-center" style={{ width: `${analytics.tbr}%` }}>
                      {analytics.tbr > 6 && <span className="text-white text-[10px] font-bold">{analytics.tbr}%</span>}
                    </div>}
                    {analytics.tir > 0 && <div className="bg-emerald-400 flex items-center justify-center" style={{ width: `${analytics.tir}%` }}>
                      {analytics.tir > 8 && <span className="text-white text-[10px] font-bold">{analytics.tir}%</span>}
                    </div>}
                    {analytics.tar > 0 && <div className="bg-amber-400 rounded-r-full flex items-center justify-center" style={{ width: `${analytics.tar}%` }}>
                      {analytics.tar > 6 && <span className="text-white text-[10px] font-bold">{analytics.tar}%</span>}
                    </div>}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="w-3 h-3 rounded-full bg-red-400" />
                        <span className="text-xs font-semibold text-slate-600">Bajo (TBR)</span>
                      </div>
                      <p className="text-xl font-bold text-red-500">{analytics.tbr}%</p>
                      <p className="text-[10px] text-slate-400">{'<'} 70 mg/dL · Meta: {'<'} 4%</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="w-3 h-3 rounded-full bg-emerald-400" />
                        <span className="text-xs font-semibold text-slate-600">En rango (TIR)</span>
                      </div>
                      <p className="text-xl font-bold text-emerald-600">{analytics.tir}%</p>
                      <p className="text-[10px] text-slate-400">70–180 mg/dL · Meta: ≥ 70%</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="w-3 h-3 rounded-full bg-amber-400" />
                        <span className="text-xs font-semibold text-slate-600">Alto (TAR)</span>
                      </div>
                      <p className="text-xl font-bold text-amber-600">{analytics.tar}%</p>
                      <p className="text-[10px] text-slate-400">{'>'} 180 mg/dL · Meta: {'<'} 25%</p>
                    </div>
                  </div>
                </div>

                {/* Gráfico de tendencia */}
                {analytics.trendData.length > 1 && (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-slate-700">Promedio diario (últimos 14 días)</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#0057B8] inline-block rounded" /> Promedio</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded border-dashed" /> Meta</span>
                      </div>
                    </div>
                    <GlucoseChart data={analytics.trendData} type="line" height={220} showLegend={false} />
                  </div>
                )}

                {/* Interpretación clínica */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#0057B8] rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Activity size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm mb-2">Interpretación clínica (ADA 2020)</p>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        <li className="flex items-start gap-2">
                          <span className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold ${analytics.tir >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                            {analytics.tir >= 70 ? '✓' : '!'}
                          </span>
                          <span>TIR {analytics.tir}% — {analytics.tir >= 70 ? 'Cumple la meta ADA ≥ 70%' : `Necesita mejorar ${70 - analytics.tir}% más para llegar a la meta`}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold ${parseFloat(analytics.eHbA1c) < 7 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                            {parseFloat(analytics.eHbA1c) < 7 ? '✓' : '!'}
                          </span>
                          <span>HbA1c estimada {analytics.eHbA1c}% — {parseFloat(analytics.eHbA1c) < 7 ? 'Dentro del objetivo ADA DM2 (< 7%)' : 'Por encima del objetivo ADA DM2 (< 7%)'}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 bg-slate-400 flex items-center justify-center text-white text-[9px] font-bold">i</span>
                          <span>Esta estimación es orientativa. Confirma con HbA1c de laboratorio con tu médico.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Exportar desde tendencias también */}
                <div className="flex justify-end">
                  <button onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all active:scale-95 shadow-sm">
                    <Download size={15} className="text-emerald-600" />
                    Exportar historial CSV
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <NavBar />
    </div>
  );
}
