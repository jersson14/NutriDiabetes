'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { chatAPI } from '@/lib/api';

// ─── Panel de fuentes citadas por NutriBot ────────────────────────────────────
function SourcesPanel({ fuentes }) {
  const [expanded, setExpanded] = useState(false);
  if (!fuentes || fuentes.length === 0) return null;

  const clinical = fuentes.filter(f => f.tipo === 'clinical');
  const tpca     = fuentes.filter(f => f.tipo === 'tpca');

  return (
    <div className="mt-2 rounded-xl border border-blue-100 overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
      >
        <span className="flex items-center gap-1.5 font-semibold text-blue-700">
          <span>📚</span>
          Fuentes ({fuentes.length})
          {clinical.length > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded-full text-[10px]">
              {clinical.length} clínica{clinical.length > 1 ? 's' : ''}
            </span>
          )}
          {tpca.length > 0 && (
            <span className="px-1.5 py-0.5 bg-green-200 text-green-800 rounded-full text-[10px]">
              TPCA
            </span>
          )}
        </span>
        <span className="text-blue-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-blue-50 bg-white">
          {/* Fuentes clínicas (IDF / ADA) */}
          {clinical.map((f, i) => (
            <div key={i} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="font-semibold text-gray-800 leading-tight">
                  {f.titulo} ({f.anio})
                </p>
                <span className="shrink-0 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                  p. {f.pagina ?? '?'} · sim. {(f.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-gray-500 mt-0.5">{f.institucion}</p>
              {f.extracto && (
                <blockquote className="mt-1.5 pl-2 border-l-2 border-blue-200 text-gray-600 italic leading-snug">
                  "{f.extracto}"
                </blockquote>
              )}
            </div>
          ))}

          {/* Fuentes TPCA */}
          {tpca.map((f, i) => (
            <div key={i} className="px-3 py-2.5 bg-green-50/40">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="font-semibold text-gray-800 leading-tight">
                  {f.nombre_alimento || f.titulo}
                </p>
                <span className="shrink-0 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                  TPCA · sim. {(f.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-gray-500 mt-0.5">{f.institucion}</p>
              {f.categoria && (
                <p className="text-gray-400 mt-0.5">Categoría: {f.categoria}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversacionId, setConversacionId] = useState(null);
  const [conversaciones, setConversaciones] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  // Fuentes pendientes de añadir al mensaje que está en streaming
  const pendingFuentesRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    loadConversaciones();
    setMessages([{
      id: 'welcome',
      rol: 'ASSISTANT',
      contenido: '¡Hola! 👋 Soy **NutriBot Perú**, tu asistente nutricional para Diabetes Tipo 2.\n\n¿En qué puedo ayudarte?\n\n🥗 **Recetas saludables** — _"Tengo pollo, quinua y brócoli"_\n📊 **Consultas nutricionales** — _"¿Cuál es el IG de la papa?"_\n💡 **Tips de salud** — _"¿Qué ejercicios me recomiendas?"_\n🍽️ **Food Sequencing** — _"¿En qué orden debo comer?"_'
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const loadConversaciones = async () => {
    try {
      const res = await chatAPI.getConversaciones();
      setConversaciones(res.data.conversaciones || []);
    } catch (err) { console.error(err); }
  };

  const loadConversacion = async (id) => {
    try {
      const res = await chatAPI.getConversacion(id);
      setMessages(res.data.mensajes || []);
      setConversacionId(id);
      if (isMobile) setSidebarOpen(false);
    } catch (err) { console.error(err); }
  };

  const newConversation = () => {
    setConversacionId(null);
    setMessages([{
      id: 'welcome',
      rol: 'ASSISTANT',
      contenido: '¡Nueva consulta! 🍎 ¿Qué ingredientes tienes hoy o qué necesitas saber sobre tu alimentación?'
    }]);
    setInput('');
    if (isMobile) setSidebarOpen(false);
  };

  const deleteConversacion = async (e, id) => {
    e.stopPropagation();
    try {
      await chatAPI.deleteConversacion(id);
      if (conversacionId === id) newConversation();
      loadConversaciones();
    } catch (err) { console.error(err); }
  };

  // Efecto de escritura — al terminar, adjunta las fuentes al mensaje
  const simulateStreaming = useCallback((fullText, fuentes) => {
    setIsStreaming(true);
    setStreamingText('');
    pendingFuentesRef.current = fuentes || [];
    let index = 0;
    const chunkSize = 3;
    const interval = setInterval(() => {
      index += chunkSize;
      if (index >= fullText.length) {
        setStreamingText('');
        setIsStreaming(false);
        setMessages(prev => [...prev, {
          id: 'resp-' + Date.now(),
          rol: 'ASSISTANT',
          contenido: fullText,
          fuentes: pendingFuentesRef.current,
        }]);
        pendingFuentesRef.current = null;
        clearInterval(interval);
      } else {
        setStreamingText(fullText.substring(0, index));
      }
    }, 15);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading || isStreaming) return;

    const userMsg = { id: Date.now(), rol: 'USER', contenido: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const res = await chatAPI.sendMessage(currentInput, conversacionId);
      const data = res.data;

      if (data.conversacionId && !conversacionId) {
        setConversacionId(data.conversacionId);
      }

      setLoading(false);
      simulateStreaming(data.mensaje.contenido, data.fuentes || []);
      loadConversaciones();
    } catch (err) {
      setLoading(false);
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        rol: 'ASSISTANT',
        contenido: '⚠️ Lo siento, hubo un error. Por favor intenta de nuevo.',
        isError: true
      }]);
    } finally {
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (text) => {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gm, '<h4 style="font-weight:700;margin:10px 0 4px;font-size:0.9rem;color:#004d8c">$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 style="font-weight:700;margin:12px 0 4px;font-size:0.95rem;color:#004d8c">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#004d8c">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em style="color:#666">$1</em>')
      .replace(/^- (.*$)/gm, '<div style="padding-left:8px;margin:2px 0">• $1</div>')
      .replace(/^(\d+)\. (.*$)/gm, '<div style="padding-left:8px;margin:2px 0"><strong>$1.</strong> $2</div>')
      .replace(/\n\n/g, '<div style="height:8px"></div>')
      .replace(/\n/g, '<br/>');
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins  = Math.floor((now - date) / 60000);
    const diffHours = Math.floor((now - date) / 3600000);
    const diffDays  = Math.floor((now - date) / 86400000);
    if (diffMins < 1)  return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7)  return `${diffDays}d`;
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  const quickSuggestions = [
    { icon: '🥗', text: 'Tengo pollo, quinua y brócoli' },
    { icon: '🍎', text: '¿Frutas con bajo IG?' },
    { icon: '🍳', text: 'Desayuno para diabético' },
    { icon: '📊', text: '¿En qué orden como?' },
  ];

  return (
    <div className="h-screen flex bg-[#EEF2F7] relative overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* OVERLAY MOBILE */}
      {sidebarOpen && isMobile && (
        <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`
        ${isMobile
          ? `fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden`
        } flex flex-col shrink-0`}
        style={{ background: 'linear-gradient(180deg, #003d73 0%, #004d8c 40%, #00553d 100%)' }}>

        <div className="p-4 pb-2 safe-area-top">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>🍎</div>
              <div>
                <p className="text-white font-bold text-sm">NutriDiabetes</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Chat Nutricional</p>
              </div>
            </div>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <button onClick={newConversation}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nueva consulta
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
          {conversaciones.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Tus consultas aparecerán aquí</p>
            </div>
          ) : (
            <>
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Historial</p>
              {conversaciones.map(conv => (
                <button key={conv.id} onClick={() => loadConversacion(conv.id)}
                  className="group w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2 active:scale-[0.98]"
                  style={{ background: conversacionId === conv.id ? 'rgba(255,255,255,0.15)' : 'transparent' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{conv.titulo || 'Consulta nutricional'}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDate(conv.fecha_creacion)}</p>
                  </div>
                  <button onClick={(e) => deleteConversacion(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                    style={{ color: 'rgba(255,255,255,0.4)' }} title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => router.push('/dashboard')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            Dashboard
          </button>
          <div className="mt-2 px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Respaldado por</p>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>TPCA 2025 · IDF 2025 · ADA 2026</p>
          </div>
        </div>
      </aside>

      {/* MAIN CHAT */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-3 md:px-4 py-3 flex items-center gap-2 md:gap-3 shrink-0 bg-white border-b border-gray-200 safe-area-top">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-all" title="Historial">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-800 flex items-center gap-1.5 text-sm md:text-base">
              <span>🤖</span> NutriBot
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                RAG
              </span>
            </h1>
            <p className="text-xs text-gray-400 hidden sm:block">TPCA 2025 · IDF Atlas 2025 · ADA Standards 2026</p>
          </div>
          <button onClick={newConversation}
            className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-all" title="Nueva consulta">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="max-w-3xl mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 md:gap-3 ${msg.rol === 'USER' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 text-xs md:text-sm ${
                  msg.rol === 'USER' ? 'bg-blue-600 text-white' : 'text-white'
                }`} style={msg.rol !== 'USER' ? { background: 'linear-gradient(135deg, #004d8c, #00A859)' } : {}}>
                  {msg.rol === 'USER' ? '👤' : '🤖'}
                </div>

                {/* Bubble + Sources */}
                <div className={`max-w-[85%] md:max-w-[80%] ${msg.isError ? 'border border-red-200 bg-red-50 rounded-2xl' : ''}`}>
                  {msg.rol === 'ASSISTANT' && (
                    <p className="text-xs font-semibold mb-1" style={{ color: '#004d8c' }}>NutriBot</p>
                  )}
                  <div className={`text-sm leading-relaxed rounded-2xl px-3 md:px-4 py-2.5 md:py-3 ${
                    msg.rol === 'USER'
                      ? 'text-white rounded-br-md'
                      : 'bg-white border border-gray-100 text-gray-700 rounded-bl-md shadow-sm'
                  }`} style={msg.rol === 'USER' ? { background: 'linear-gradient(135deg, #005BAC, #004080)' } : {}}
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.contenido) }} />

                  {/* Panel de fuentes solo en mensajes del asistente */}
                  {msg.rol === 'ASSISTANT' && <SourcesPanel fuentes={msg.fuentes} />}

                  {msg.tiempoRespuesta && (
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      ⚡ {(msg.tiempoRespuesta / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming (sin fuentes hasta que termina) */}
            {isStreaming && streamingText && (
              <div className="flex gap-2 md:gap-3">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 text-xs md:text-sm text-white"
                  style={{ background: 'linear-gradient(135deg, #004d8c, #00A859)' }}>🤖</div>
                <div className="max-w-[85%] md:max-w-[80%]">
                  <p className="text-xs font-semibold mb-1" style={{ color: '#004d8c' }}>NutriBot</p>
                  <div className="text-sm leading-relaxed rounded-2xl px-3 md:px-4 py-2.5 md:py-3 bg-white border border-gray-100 text-gray-700 rounded-bl-md shadow-sm"
                    dangerouslySetInnerHTML={{ __html: formatMessage(streamingText) }} />
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex gap-2 md:gap-3">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 text-xs md:text-sm text-white"
                  style={{ background: 'linear-gradient(135deg, #004d8c, #00A859)' }}>🤖</div>
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#004d8c' }}>NutriBot</p>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-3 md:px-4 py-2.5 md:py-3 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{animationDelay:'0ms', background:'#00A859'}} />
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{animationDelay:'150ms', background:'#005BAC'}} />
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{animationDelay:'300ms', background:'#00A859'}} />
                      </div>
                      <span className="text-xs text-gray-400">Buscando en TPCA · IDF · ADA...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick suggestions */}
            {messages.length <= 1 && !loading && !isStreaming && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {quickSuggestions.map((sug, i) => (
                  <button key={i} onClick={() => { setInput(sug.text); }}
                    className="text-left p-2.5 md:p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 active:scale-[0.98] transition-all text-sm">
                    <span className="text-base md:text-lg">{sug.icon}</span>
                    <p className="text-gray-600 mt-1 text-xs md:text-sm leading-tight">{sug.text}</p>
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input */}
        <footer className="shrink-0 bg-white border-t border-gray-200 safe-area-bottom">
          <div className="max-w-3xl mx-auto px-3 md:px-4 py-2 md:py-3">
            <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all px-3 md:px-4 py-2">
              <textarea
                ref={(el) => { textareaRef.current = el; inputRef.current = el; }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Escribe tu consulta..."
                rows={1}
                disabled={loading || isStreaming}
                className="flex-1 bg-transparent outline-none resize-none text-sm text-gray-800 placeholder-gray-400 py-1.5"
                style={{ maxHeight: '100px', fontSize: '16px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || isStreaming}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 active:scale-90"
                style={{ background: '#005BAC' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-1.5 px-2">
              NutriBot usa fuentes verificadas: TPCA 2025 CENAN/INS · IDF Atlas 2025 · ADA Standards 2026. No reemplaza la consulta médica.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
