'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { alimentosAPI } from '@/lib/api';
import { Header, FilterBar, Badge, NavBar } from '@/components';
import { ChefHat, Flame, Leaf, Zap } from 'lucide-react';

export default function AlimentosPage() {
  const router = useRouter();
  const [alimentos, setAlimentos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [search, setSearch] = useState('');
  const [recFilter, setRecFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadCategorias();
    loadAlimentos();
  }, [search, recFilter, page]);

  const loadCategorias = async () => {
    try {
      const res = await alimentosAPI.getCategorias();
      setCategorias(res.data.categorias || []);
    } catch (err) { console.error(err); }
  };

  const loadAlimentos = async () => {
    setLoading(true);
    try {
      const res = await alimentosAPI.getAll({
        search, recomendacion: recFilter, page, limit: 20
      });
      setAlimentos(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getRecommendationBadge = (rec) => {
    const badges = {
      RECOMENDADO: { variant: 'green', text: '✅ Recomendado' },
      MODERADO: { variant: 'orange', text: '⚠️ Moderado' },
      LIMITAR: { variant: 'red', text: '🔴 Limitar' }
    };
    return badges[rec] || { variant: 'blue', text: '📊 Información' };
  };

  const getIGColor = (ig) => {
    if (!ig) return { color: 'blue', text: 'S/D' };
    if (ig <= 55) return { color: 'green', text: `${ig}` };
    if (ig <= 69) return { color: 'orange', text: `${ig}` };
    return { color: 'red', text: `${ig}` };
  };

  const filters = [
    { id: '', label: 'Todos', active: !recFilter },
    { id: 'RECOMENDADO', label: '✅ Recomendados', active: recFilter === 'RECOMENDADO' },
    { id: 'MODERADO', label: '⚠️ Moderados', active: recFilter === 'MODERADO' },
    { id: 'LIMITAR', label: '🔴 Limitar', active: recFilter === 'LIMITAR' },
  ];

  return (
    <div className="page-with-nav min-h-screen bg-[#EEF2F7] pb-32">
      <Header 
        title="Tabla de Alimentos"
        subtitle="Guía nutricional para diabéticos"
        variant="green"
        showChat={false}
        showLogout={true}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-8 animate-slide-up">
          <FilterBar
            searchValue={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            filters={filters}
            onFilterChange={(filterId) => {
              setRecFilter(filterId);
              setPage(1);
            }}
            placeholder="🔍 Buscar alimento (quinua, pollo, espinaca...)"
          />
        </div>

        {/* Results Count */}
        {!loading && (
          <p className="text-sm text-gray-600 font-medium mb-4">
            {alimentos.length} alimento{alimentos.length !== 1 ? 's' : ''} encontrado{alimentos.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16 animate-fade-in">
            <span className="text-6xl mb-4 block animate-bounce">🥗</span>
            <p className="text-gray-600 font-semibold">Cargando alimentos...</p>
          </div>
        )}

        {/* No Results */}
        {!loading && alimentos.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-gray-600 font-semibold">Sin resultados</p>
            <p className="text-sm text-gray-500 mt-2">Intenta con otro término de búsqueda</p>
          </div>
        )}

        {/* Alimentos Grid */}
        {!loading && alimentos.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {alimentos.map((a, idx) => {
                const rec = getRecommendationBadge(a.recomendacion);
                const igColor = getIGColor(a.indice_glucemico);
                return (
                  <div
                    key={a.id}
                    className="bg-white rounded-2xl shadow-soft hover:shadow-medium border border-gray-100 overflow-hidden transition-all duration-300 hover:scale-105 animate-scale-in"
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
                      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                        <span className="text-sm text-gray-600 font-medium">Índice Glucémico</span>
                        <Badge variant={igColor.color} size="md">IG: {igColor.text}</Badge>
                      </div>

                      {/* Macros */}
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
    </div>
  );
}
