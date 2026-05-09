'use client';
import { useState, useEffect } from 'react';
import { alimentosAPI, comidasAPI } from '@/lib/api';
import { Header, FilterBar, Badge, NavBar } from '@/components';
import { ChefHat, Flame, Leaf, Zap, Plus, X, Check, BookOpen } from 'lucide-react';

const TIPOS_COMIDA = [
  { value: 'DESAYUNO',    label: 'Desayuno',    emoji: '☀️' },
  { value: 'MEDIA_MANANA', label: 'Media mañana', emoji: '🍎' },
  { value: 'ALMUERZO',    label: 'Almuerzo',    emoji: '🍽️' },
  { value: 'MEDIA_TARDE', label: 'Media tarde', emoji: '🥤' },
  { value: 'CENA',        label: 'Cena',        emoji: '🌙' },
  { value: 'SNACK',       label: 'Snack',       emoji: '🥜' },
];

function calcNutri(alimento, gramos) {
  const factor = gramos / 100;
  return {
    calorias:      Math.round((alimento.energia_kcal       || 0) * factor * 10) / 10,
    carbohidratos: Math.round((alimento.carbohidratos_totales_g || 0) * factor * 10) / 10,
    proteinas:     Math.round((alimento.proteinas_g        || 0) * factor * 10) / 10,
    grasas:        Math.round((alimento.grasas_totales_g   || 0) * factor * 10) / 10,
    fibra:         Math.round((alimento.fibra_dietaria_g   || 0) * factor * 10) / 10,
  };
}

export default function AlimentosPage() {
  const [alimentos, setAlimentos] = useState([]);
  const [search, setSearch] = useState('');
  const [recFilter, setRecFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userName, setUserName] = useState('');

  // Modal de registro de comida
  const [modal, setModal] = useState(null);   // alimento seleccionado
  const [porcion, setPorcion] = useState(100);
  const [tipoComida, setTipoComida] = useState('ALMUERZO');
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUserName(JSON.parse(u).nombre || JSON.parse(u).nombre_completo || '');
    loadAlimentos();
  }, [search, recFilter, page]);

  const loadAlimentos = async () => {
    setLoading(true);
    try {
      const res = await alimentosAPI.getAll({ search, recomendacion: recFilter, page, limit: 20 });
      setAlimentos(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openModal = (alimento) => {
    setModal(alimento);
    setPorcion(100);
    setGuardadoOk(false);
  };

  const handleRegistrar = async () => {
    if (!modal || guardando) return;
    setGuardando(true);
    try {
      const nutri = calcNutri(modal, porcion);
      await comidasAPI.registrar({
        tipo_comida:          tipoComida,
        alimento_id:          modal.id,
        nombre_alimento:      modal.nombre_comun || modal.nombre,
        cantidad_g:           porcion,
        calorias_total:       nutri.calorias,
        carbohidratos_total_g: nutri.carbohidratos,
        proteinas_total_g:    nutri.proteinas,
        grasas_total_g:       nutri.grasas,
        fibra_total_g:        nutri.fibra,
      });
      setGuardadoOk(true);
      setTimeout(() => setModal(null), 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  const getRecommendationBadge = (rec) => {
    const badges = {
      RECOMENDADO: { variant: 'green',  text: '✅ Recomendado' },
      MODERADO:    { variant: 'orange', text: '⚠️ Moderado'   },
      LIMITAR:     { variant: 'red',    text: '🔴 Limitar'     },
    };
    return badges[rec] || { variant: 'blue', text: '📊 Información' };
  };

  const getIGColor = (ig) => {
    if (!ig) return { color: 'blue',   text: 'S/D' };
    if (ig <= 55) return { color: 'green',  text: `${ig}` };
    if (ig <= 69) return { color: 'orange', text: `${ig}` };
    return          { color: 'red',    text: `${ig}` };
  };

  const filters = [
    { id: '',           label: 'Todos',          active: !recFilter                     },
    { id: 'RECOMENDADO', label: '✅ Recomendados', active: recFilter === 'RECOMENDADO'   },
    { id: 'MODERADO',   label: '⚠️ Moderados',   active: recFilter === 'MODERADO'       },
    { id: 'LIMITAR',    label: '🔴 Limitar',      active: recFilter === 'LIMITAR'        },
  ];

  return (
    <div className="page-with-nav min-h-screen bg-[#EEF2F7] pb-32">
      <Header
        title="Tabla de Alimentos"
        subtitle="Guía nutricional para diabéticos"
        variant="green"
        showChat={false}
        showLogout={true}
        userName={userName}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-8 animate-slide-up">
          <FilterBar
            searchValue={search}
            onSearchChange={(val) => { setSearch(val); setPage(1); }}
            filters={filters}
            onFilterChange={(filterId) => { setRecFilter(filterId); setPage(1); }}
            placeholder="🔍 Buscar alimento (quinua, pollo, espinaca...)"
          />
        </div>

        {!loading && (
          <p className="text-sm text-gray-600 font-medium mb-4">
            {alimentos.length} alimento{alimentos.length !== 1 ? 's' : ''} encontrado{alimentos.length !== 1 ? 's' : ''}
          </p>
        )}

        {loading && (
          <div className="text-center py-16 animate-fade-in">
            <span className="text-6xl mb-4 block animate-bounce">🥗</span>
            <p className="text-gray-600 font-semibold">Cargando alimentos...</p>
          </div>
        )}

        {!loading && alimentos.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-gray-600 font-semibold">Sin resultados</p>
            <p className="text-sm text-gray-500 mt-2">Intenta con otro término de búsqueda</p>
          </div>
        )}

        {!loading && alimentos.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {alimentos.map((a, idx) => {
                const rec     = getRecommendationBadge(a.recomendacion);
                const igColor = getIGColor(a.indice_glucemico);
                return (
                  <div
                    key={a.id}
                    className="bg-white rounded-2xl shadow-soft hover:shadow-medium border border-gray-100 overflow-hidden transition-all duration-300 animate-scale-in"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    {/* Header con recomendación */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{a.icono || '🍽️'}</span>
                        <div>
                          <h3 className="font-bold text-gray-900">{a.nombre_comun || a.nombre}</h3>
                          <p className="text-xs text-gray-500">{a.categoria}</p>
                        </div>
                      </div>
                      <Badge variant={rec.variant} size="sm">{rec.text}</Badge>
                    </div>

                    {/* Nutrición */}
                    <div className="p-6 space-y-4">
                      {/* IG */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <span className="text-sm text-gray-600 font-medium">Índice Glucémico</span>
                        <Badge variant={igColor.color} size="md">IG: {igColor.text}</Badge>
                      </div>

                      {/* Macros por 100g */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Por 100 g</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                            <Flame size={20} className="text-blue-600 mx-auto mb-1" />
                            <p className="text-sm font-bold text-blue-900">{a.energia_kcal || '-'}</p>
                            <p className="text-xs text-blue-600 font-medium">kcal</p>
                          </div>
                          <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                            <Zap size={20} className="text-orange-600 mx-auto mb-1" />
                            <p className="text-sm font-bold text-orange-900">{a.carbohidratos_totales_g || '-'}g</p>
                            <p className="text-xs text-orange-600 font-medium">Carbs</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                            <Leaf size={20} className="text-green-600 mx-auto mb-1" />
                            <p className="text-sm font-bold text-green-900">{a.proteinas_g || '-'}g</p>
                            <p className="text-xs text-green-600 font-medium">Proteína</p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                            <ChefHat size={20} className="text-purple-600 mx-auto mb-1" />
                            <p className="text-sm font-bold text-purple-900">{a.fibra_dietaria_g || '-'}g</p>
                            <p className="text-xs text-purple-600 font-medium">Fibra</p>
                          </div>
                        </div>
                      </div>

                      {/* Botón agregar al diario */}
                      <button
                        onClick={() => openModal(a)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all active:scale-95"
                      >
                        <Plus size={15} /> Agregar al diario
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-8">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-6 py-3 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  ← Anterior
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-medium">Página</span>
                  <div className="bg-white border-2 border-blue-500 rounded-lg px-4 py-2">
                    <span className="font-bold text-blue-600">{page}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-gray-600">{totalPages}</span>
                  </div>
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-6 py-3 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <NavBar />

      {/* ── Modal: Agregar al diario ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(null)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 space-y-5 shadow-2xl animate-slide-up">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{modal.icono || '🍽️'}</span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{modal.nombre_comun || modal.nombre}</h3>
                  <p className="text-xs text-gray-500">{modal.categoria}</p>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            {/* Tamaño de porción */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tamaño de porción
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1" max="2000"
                  value={porcion}
                  onChange={e => setPorcion(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-28 px-4 py-3 text-center text-xl font-bold rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none tabular-nums"
                />
                <span className="text-gray-500 font-medium">gramos</span>
                <div className="flex gap-1 ml-auto">
                  {[50, 100, 150, 200].map(g => (
                    <button
                      key={g}
                      onClick={() => setPorcion(g)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        porcion === g
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {g}g
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview nutricional */}
            {(() => {
              const n = calcNutri(modal, porcion);
              return (
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'kcal',    value: n.calorias,       color: 'text-blue-600'    },
                    { label: 'Carbs g', value: n.carbohidratos,  color: 'text-orange-600'  },
                    { label: 'Prot g',  value: n.proteinas,      color: 'text-green-600'   },
                    { label: 'Fibra g', value: n.fibra,          color: 'text-purple-600'  },
                  ].map(item => (
                    <div key={item.label}>
                      <p className={`text-lg font-bold tabular-nums ${item.color}`}>{item.value}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Tipo de comida */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de comida</label>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_COMIDA.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTipoComida(t.value)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all border-2 ${
                      tipoComida === t.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Botón guardar */}
            <button
              onClick={handleRegistrar}
              disabled={guardando || guardadoOk}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                guardadoOk
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
              }`}
            >
              {guardadoOk
                ? <><Check size={16} /> ¡Registrado en tu diario!</>
                : guardando
                  ? 'Guardando...'
                  : <><BookOpen size={16} /> Registrar en diario</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
