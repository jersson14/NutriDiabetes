'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { comidasAPI } from '@/lib/api';
import { NavBar } from '@/components';
import { Plus, Trash2, Flame, Zap, Leaf, ChefHat, UtensilsCrossed } from 'lucide-react';

const TIPO_CONFIG = {
  DESAYUNO:    { label: 'Desayuno',     emoji: '☀️',  color: 'bg-amber-50  border-amber-200',  badge: 'bg-amber-100 text-amber-700'  },
  MEDIA_MANANA:{ label: 'Media mañana', emoji: '🍎',  color: 'bg-green-50  border-green-200',  badge: 'bg-green-100 text-green-700'  },
  ALMUERZO:    { label: 'Almuerzo',     emoji: '🍽️', color: 'bg-blue-50   border-blue-200',   badge: 'bg-blue-100  text-blue-700'   },
  MEDIA_TARDE: { label: 'Media tarde',  emoji: '🥤',  color: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700'},
  CENA:        { label: 'Cena',         emoji: '🌙',  color: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700'},
  SNACK:       { label: 'Snack',        emoji: '🥜',  color: 'bg-rose-50   border-rose-200',   badge: 'bg-rose-100  text-rose-700'  },
};

const ORDEN_TIPOS = ['DESAYUNO','MEDIA_MANANA','ALMUERZO','MEDIA_TARDE','CENA','SNACK'];

export default function ComidasPage() {
  const router = useRouter();
  const [comidas, setComidas] = useState([]);
  const [totales, setTotales] = useState({});
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [eliminando, setEliminando] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    const u = localStorage.getItem('user');
    if (u) setUserName(JSON.parse(u).nombre?.split(' ')[0] || '');
    cargarComidas();
  }, []);

  const cargarComidas = async () => {
    setLoading(true);
    try {
      const res = await comidasAPI.getHoy();
      setComidas(res.data.comidas || []);
      setTotales(res.data.totales || {});
    } catch (err) {
      console.error('Error cargando comidas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (id) => {
    setEliminando(id);
    try {
      await comidasAPI.eliminar(id);
      await cargarComidas();
    } catch (err) {
      console.error(err);
    } finally {
      setEliminando(null);
    }
  };

  // Agrupar por tipo de comida
  const porTipo = ORDEN_TIPOS.reduce((acc, tipo) => {
    const items = comidas.filter(c => c.tipo_comida === tipo);
    if (items.length > 0) acc[tipo] = items;
    return acc;
  }, {});

  const today = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <div className="page-with-nav min-h-screen bg-[#EEF2F7] pb-32">

      {/* Header */}
      <div className="bg-gradient-to-br from-[#059669] via-[#047857] to-[#065F46] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.9) 1px,transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative px-5 pt-8 pb-20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-200/70 text-sm font-medium">
                {userName ? `Hola, ${userName}` : 'Mi diario'}
              </p>
              <h1 className="text-white text-2xl font-bold mt-0.5">Diario de Comidas</h1>
              <p className="text-emerald-200/60 text-xs mt-1 capitalize">{today}</p>
            </div>
            <button
              onClick={() => router.push('/alimentos')}
              className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-xl border border-white/20 transition-all active:scale-95"
            >
              <Plus size={16} /> Agregar
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-10 relative z-10 space-y-4">

        {/* Resumen del día */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Resumen del día</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { icon: Flame,    label: 'Calorías', value: Math.round(totales.calorias      || 0), unit: 'kcal', color: 'text-blue-600',   bg: 'bg-blue-50'   },
              { icon: Zap,      label: 'Carbs',    value: Math.round(totales.carbohidratos || 0), unit: 'g',    color: 'text-orange-600', bg: 'bg-orange-50' },
              { icon: Leaf,     label: 'Proteínas',value: Math.round(totales.proteinas     || 0), unit: 'g',    color: 'text-green-600',  bg: 'bg-green-50'  },
              { icon: ChefHat,  label: 'Fibra',    value: Math.round((totales.fibra        || 0) * 10) / 10, unit: 'g', color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(({ icon: Icon, label, value, unit, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3`}>
                <Icon size={18} className={`${color} mx-auto mb-1`} />
                <p className={`text-xl font-bold ${color} tabular-nums`}>{value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{unit}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {comidas.length > 0 && (
            <p className="text-center text-xs text-gray-400 mt-3">
              {comidas.length} alimento{comidas.length !== 1 ? 's' : ''} registrado{comidas.length !== 1 ? 's' : ''} hoy
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <span className="text-5xl animate-bounce block mb-3">🥗</span>
            <p className="text-gray-500 font-medium">Cargando tu diario...</p>
          </div>
        )}

        {/* Sin comidas */}
        {!loading && comidas.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <UtensilsCrossed size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-600 font-semibold text-lg">No hay comidas registradas hoy</p>
            <p className="text-gray-400 text-sm mt-1 mb-5">Agrega alimentos desde la tabla nutricional</p>
            <button
              onClick={() => router.push('/alimentos')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all active:scale-95"
            >
              <Plus size={16} /> Explorar alimentos
            </button>
          </div>
        )}

        {/* Comidas agrupadas por tipo */}
        {!loading && Object.entries(porTipo).map(([tipo, items]) => {
          const cfg = TIPO_CONFIG[tipo] || { label: tipo, emoji: '🍽️', color: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-700' };
          const kcalTipo = items.reduce((s, c) => s + parseFloat(c.calorias_total || 0), 0);
          return (
            <div key={tipo} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${cfg.color}`}>
              {/* Tipo header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-current/10">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cfg.emoji}</span>
                  <span className="font-bold text-gray-800">{cfg.label}</span>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>
                  {Math.round(kcalTipo)} kcal
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-100 bg-white">
                {items.map(comida => {
                  // json_agg devuelve [null] cuando no hay alimentos asociados
                  const primerAlimento = Array.isArray(comida.alimentos) && comida.alimentos[0]?.nombre
                    ? comida.alimentos[0] : null;
                  const nombreMostrar = primerAlimento?.nombre || '(sin detalle)';
                  const cantidadMostrar = primerAlimento?.cantidad_g;
                  return (
                  <div key={comida.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {nombreMostrar}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        <span className="font-medium text-blue-600">{Math.round(comida.calorias_total || 0)} kcal</span>
                        {cantidadMostrar && <span>{cantidadMostrar}g</span>}
                        {comida.carbohidratos_total_g > 0 && <span>C: {Math.round(comida.carbohidratos_total_g)}g</span>}
                        {comida.proteinas_total_g > 0 && <span>P: {Math.round(comida.proteinas_total_g)}g</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEliminar(comida.id)}
                      disabled={eliminando === comida.id}
                      className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Botón agregar más */}
        {!loading && comidas.length > 0 && (
          <button
            onClick={() => router.push('/alimentos')}
            className="w-full py-4 border-2 border-dashed border-emerald-300 rounded-2xl text-emerald-600 font-semibold text-sm hover:border-emerald-400 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Agregar más alimentos
          </button>
        )}
      </main>

      <NavBar />
    </div>
  );
}
