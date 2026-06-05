'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { perfilAPI } from '@/lib/api';
import { Header, FormField, NavBar, Button } from '@/components';
import { User, Heart, Pill, Check, AlertCircle } from 'lucide-react';

const IMC_RANGOS = [
  { min: 0,    max: 18.5, label: 'Bajo peso',   color: '#3B82F6', bg: '#EFF6FF', bar: '#BFDBFE', emoji: '⚠️' },
  { min: 18.5, max: 25,   label: 'Normal',       color: '#16A34A', bg: '#F0FDF4', bar: '#BBF7D0', emoji: '✅' },
  { min: 25,   max: 30,   label: 'Sobrepeso',    color: '#D97706', bg: '#FFFBEB', bar: '#FDE68A', emoji: '⚡' },
  { min: 30,   max: 35,   label: 'Obesidad I',   color: '#EA580C', bg: '#FFF7ED', bar: '#FED7AA', emoji: '🔴' },
  { min: 35,   max: 40,   label: 'Obesidad II',  color: '#DC2626', bg: '#FEF2F2', bar: '#FECACA', emoji: '🔴' },
  { min: 40,   max: 999,  label: 'Obesidad III', color: '#7F1D1D', bg: '#FEF2F2', bar: '#FCA5A5', emoji: '🔴' },
];

function IMCCard({ imc }) {
  const rango = IMC_RANGOS.find(r => imc >= r.min && imc < r.max) || IMC_RANGOS[IMC_RANGOS.length - 1];
  // Posición del marcador en la barra (0–100%)
  const pct = Math.min(Math.max(((imc - 10) / (45 - 10)) * 100, 0), 100);

  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ background: rango.bg, borderColor: rango.bar }}>
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">IMC Calculado</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-4xl font-extrabold" style={{ color: rango.color }}>{imc.toFixed(2)}</span>
            <span className="text-sm text-gray-400 font-medium">kg/m²</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl">{rango.emoji}</span>
          <p className="text-sm font-bold mt-0.5" style={{ color: rango.color }}>{rango.label}</p>
        </div>
      </div>

      {/* Barra de progreso con marcador */}
      <div>
        <div className="relative h-3 rounded-full overflow-visible" style={{
          background: 'linear-gradient(to right, #3B82F6 0%, #16A34A 28%, #D97706 46%, #EA580C 64%, #DC2626 80%, #7F1D1D 100%)'
        }}>
          {/* Marcador */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white shadow-md transition-all duration-500"
            style={{ left: `${pct}%`, background: rango.color }}
          />
        </div>
        {/* Etiquetas */}
        <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium">
          <span>Bajo</span>
          <span>Normal</span>
          <span>Sobrepeso</span>
          <span>Ob. I</span>
          <span>Ob. II</span>
          <span>Ob. III</span>
        </div>
      </div>

      {/* Tabla de rangos */}
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        {IMC_RANGOS.map(r => (
          <div
            key={r.label}
            className="rounded-xl px-2 py-1.5 text-center transition-all"
            style={{
              background: rango.label === r.label ? r.color : 'rgba(0,0,0,0.04)',
              color: rango.label === r.label ? '#fff' : '#6B7280',
            }}
          >
            <p className="text-[10px] font-semibold leading-tight">{r.label}</p>
            <p className="text-[10px] opacity-80 leading-tight">
              {r.max === 999 ? `≥ ${r.min}` : `${r.min}–${r.max}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({});
  const [userName, setUserName] = useState('');
  const [esRequerido, setEsRequerido] = useState(false);

  // IMC calculado en tiempo real a partir de peso y talla del formulario
  const imcCalculado = useMemo(() => {
    const p = parseFloat(form.peso_kg);
    const t = parseFloat(form.talla_cm);
    if (!p || !t || t <= 0) return null;
    return p / Math.pow(t / 100, 2);
  }, [form.peso_kg, form.talla_cm]);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    const u = localStorage.getItem('user');
    if (u) setUserName(JSON.parse(u).nombre || JSON.parse(u).nombre_completo || '');
    // Detectar si fue redirigido por falta de perfil
    const params = new URLSearchParams(window.location.search);
    if (params.get('requerido') === 'true') setEsRequerido(true);
    loadPerfil();
  }, []);

  const loadPerfil = async () => {
    try {
      const res = await perfilAPI.get();
      setPerfil(res.data.perfil);
      setForm(res.data.perfil || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await perfilAPI.updateSalud(form);
      // Marcar perfil como completado y limpiar flag de nuevo usuario
      localStorage.removeItem('esNuevo');
      localStorage.setItem('perfil_completo', '1');
      setEsRequerido(false);
      setSuccess('Perfil guardado ✅ Ahora puedes usar todas las funciones.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Error al guardar los cambios');
      setTimeout(() => setSaveError(''), 5000);
    } finally { setSaving(false); }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center animate-slide-up">
          <span className="text-6xl animate-bounce inline-block">👤</span>
          <p className="text-gray-600 mt-4 font-semibold">Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-with-nav min-h-screen bg-[#EEF2F7] pb-32">
      <Header
        title="Mi Perfil DM2"
        subtitle="Gestiona tu información clínica"
        variant="purple"
        showChat={false}
        showLogout={true}
        userName={userName}
      />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10 space-y-6">
        {/* Banner perfil obligatorio */}
        {esRequerido && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-slide-down">
            <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Completa tu perfil para continuar</p>
              <p className="text-xs text-amber-600 mt-0.5">El sistema necesita tus datos clínicos para personalizar las recomendaciones nutricionales.</p>
            </div>
          </div>
        )}

        {saveError && (
          <div className="bg-red-50 border border-red-200/80 rounded-xl p-4 flex items-start gap-3 animate-slide-down">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">Error al guardar</p>
              <p className="text-sm text-red-600 mt-0.5">{saveError}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3 animate-slide-down">
            <Check size={18} className="text-emerald-600 flex-shrink-0" />
            <p className="font-semibold text-emerald-800 text-sm">{success}</p>
          </div>
        )}

        {/* Datos Personales */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 sm:p-8 animate-slide-up">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User size={24} className="text-blue-600" />
            </div>
            Datos Personales
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Peso (kg)"
                type="number"
                placeholder="70"
                value={form.peso_kg || ''}
                onChange={(e) => handleChange('peso_kg', e.target.value)}
              />
              <FormField
                label="Talla (cm)"
                type="number"
                placeholder="165"
                value={form.talla_cm || ''}
                onChange={(e) => handleChange('talla_cm', e.target.value)}
              />
            </div>

            {imcCalculado && <IMCCard imc={imcCalculado} />}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Sexo</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'M', label: '♂️ Masculino' },
                  { value: 'F', label: '♀️ Femenino' }
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChange('sexo', option.value)}
                    className={`py-3 rounded-xl font-semibold transition-all border-2 ${
                      form.sexo === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Nivel de Actividad</label>
              <select
                value={form.nivel_actividad || 'SEDENTARIO'}
                onChange={(e) => handleChange('nivel_actividad', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium"
              >
                <option value="SEDENTARIO">🏃 Sedentario</option>
                <option value="LIGERO">🚶 Ligero</option>
                <option value="MODERADO">🏃‍♂️ Moderado</option>
                <option value="ACTIVO">⚡ Activo</option>
                <option value="MUY_ACTIVO">🔥 Muy activo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Datos Clínicos DM2 */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 sm:p-8 animate-slide-up stagger-1">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Heart size={24} className="text-red-600" />
            </div>
            Datos Clínicos DM2
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Clasificación</label>
              <select
                value={form.clasificacion_dm2 || 'DM2_SIN_COMPLICACIONES'}
                onChange={(e) => handleChange('clasificacion_dm2', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none font-medium"
              >
                <option value="DM2_SIN_COMPLICACIONES">DM2 Sin complicaciones</option>
                <option value="DM2_CON_COMPLICACIONES">DM2 Con complicaciones</option>
                <option value="DM2_CONTROLADA">DM2 Controlada (HbA1c &lt; 7%)</option>
                <option value="DM2_NO_CONTROLADA">DM2 No controlada (HbA1c ≥ 7%)</option>
                <option value="PRE_DIABETES">Pre-diabetes</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="HbA1c (%)"
                type="number"
                placeholder="6.5"
                value={form.hemoglobina_glicosilada || ''}
                onChange={(e) => handleChange('hemoglobina_glicosilada', e.target.value)}
                helperText="Target: < 7%"
              />
              <FormField
                label="Año de Diagnóstico"
                type="number"
                placeholder="2020"
                value={form.anio_diagnostico || ''}
                onChange={(e) => handleChange('anio_diagnostico', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Medicamentos */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 sm:p-8 animate-slide-up stagger-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Pill size={24} className="text-green-600" />
            </div>
            Medicamentos
          </h2>

          <div className="space-y-2">
            {[
              { field: 'usa_metformina', label: 'Metformina', icon: '💊' },
              { field: 'usa_insulina', label: 'Insulina', icon: '💉' },
              { field: 'usa_sulfonilureas', label: 'Sulfonilureas (Glibenclamida)', icon: '🔴' },
              { field: 'usa_inhibidores_dpp4', label: 'Inhibidores DPP-4 (Sitagliptina)', icon: '🟢' },
            ].map(med => (
              <label
                key={med.field}
                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors border border-gray-100"
              >
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-2xl">{med.icon}</span>
                  <span className="font-medium text-gray-700">{med.label}</span>
                </div>
                <input
                  type="checkbox"
                  checked={form[med.field] || false}
                  onChange={(e) => handleChange(med.field, e.target.checked)}
                  className="w-6 h-6 rounded border-2 border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="animate-slide-up stagger-3">
          <Button
            fullWidth
            size="lg"
            loading={saving}
            onClick={handleSave}
            variant="primary"
          >
            💾 Guardar Cambios
          </Button>
        </div>
      </main>

      <NavBar />
    </div>
  );
}
