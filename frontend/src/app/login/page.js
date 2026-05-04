"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { authAPI } from "@/lib/api";

const LogoNutriDiabetes = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="appleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00C96D" />
        <stop offset="100%" stopColor="#008647" />
      </linearGradient>
      <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3387D6" />
        <stop offset="100%" stopColor="#005BAC" />
      </linearGradient>
    </defs>
    <path d="M50 88 C15 88, 10 45, 25 25 C35 10, 45 18, 50 28 C55 18, 65 10, 75 25 C90 45, 85 88, 50 88 Z" fill="url(#appleGrad)" />
    <path d="M48 26 C43 5, 68 0, 70 20 C70 20, 55 25, 48 26 Z" fill="url(#leafGrad)" />
    <path d="M22 55 L38 55 L45 38 L55 72 L62 55 L78 55" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const features = [
  { icon: "🧠", title: "IA Explicable (XAI)", description: 'Te explica por qué la recomendación: "el olluco ralentiza la absorción del azúcar"' },
  { icon: "🥘", title: "Cocina con lo que tienes", description: "Pantry-Based Logic: recetas con ingredientes locales que reducen gastos hasta S/1,200/mes" },
  { icon: "🥦", title: "Secuenciación Alimentaria", description: "Orden óptimo de ingesta: vegetales → proteína → carbohidratos (reduce pico glucémico 74%)" },
  { icon: "🇵🇪", title: "Biodiversidad Peruana", description: "Quinua, tarwi, aguaymanto, camu-camu: alimentos que las IAs occidentales ignoran" },
];

const stats = [
  { value: "888", label: "Alimentos TPCA" },
  { value: "74%", label: "Reduce pico IG" },
  { value: "95%+", label: "Precisión RAG" },
  { value: "ODS 3", label: "Salud y bienestar" },
];

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin]           = useState(true);
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nombreCompleto: "" });
  const [mounted, setMounted]           = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("accessToken")) router.push("/dashboard");
  }, [router]);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError("");
      try {
        const response = await authAPI.loginGoogle(tokenResponse.access_token);
        const { accessToken, user } = response.data;
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("user", JSON.stringify(user));
        setSuccess("¡Bienvenido! Redirigiendo...");
        setTimeout(() => router.push("/dashboard"), 800);
      } catch (err) {
        setError(err.response?.data?.error || "Error al conectar con Google");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError("Error al iniciar sesión con Google"),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const response = isLogin
        ? await authAPI.login(form.email, form.password)
        : await authAPI.register(form);
      const { accessToken, user } = response.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
      setSuccess(isLogin ? "¡Bienvenido de vuelta!" : "¡Cuenta creada exitosamente!");
      setTimeout(() => router.push("/dashboard"), 800);
    } catch (err) {
      setError(err.response?.data?.error || "Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => { setIsLogin(!isLogin); setError(""); setSuccess(""); };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── LEFT PANEL (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1F4E] via-[#0057B8] to-[#006E41]" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        {/* Glow blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col h-full p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto animate-fade-in">
            <div className="w-12 h-12 bg-white/15 rounded-2xl p-2.5 border border-white/20 backdrop-blur-sm">
              <LogoNutriDiabetes />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">NutriDiabetes</h1>
              <p className="text-emerald-300 text-xs font-semibold tracking-widest uppercase">Perú · DM2</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="py-8">
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-3 animate-slide-up">
              Tu copiloto nutricional
              <span className="block text-emerald-300 text-2xl xl:text-3xl mt-1">con IA para Diabetes Tipo 2</span>
            </h2>
            <p className="text-white/65 text-sm leading-relaxed max-w-sm animate-slide-up stagger-1">
              Basado en la Tabla Peruana de Alimentos (CENAN/INS) con 888 alimentos.
            </p>

            {/* Hero food image */}
            <div className="mt-5 mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl" style={{ height: '180px' }}>
                <img
                  src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop"
                  alt="Alimentación saludable NutriDiabetes"
                  className="w-full h-full object-cover object-center"
                  onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <p className="text-white text-xs font-semibold">🇵🇪 Diseñado para la realidad peruana</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2.5">
              {features.slice(0, 3).map((f, i) => (
                <div key={i} className="feature-card animate-slide-right" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg flex-shrink-0 border border-white/10">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{f.title}</p>
                    <p className="text-white/55 text-xs leading-relaxed mt-0.5">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 pt-8 border-t border-white/15 mt-auto animate-fade-in">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-white/45 text-xs mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-white/30 text-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
            Respaldado por TPCA 2025 · CENAN/INS · Universidad Continental
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL — Auth Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white relative overflow-hidden">
        {/* Soft background blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-50 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 opacity-70" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-emerald-50 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 opacity-70" />

        <div className="relative w-full max-w-sm animate-scale-in">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-[#0057B8] to-[#006E41] rounded-2xl p-3 mx-auto mb-3">
              <LogoNutriDiabetes />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">NutriDiabetes</h1>
            <p className="text-slate-500 text-sm mt-1">Sistema de nutrición IA para DM2</p>
          </div>

          {/* Form header */}
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-900">
              {isLogin ? "Bienvenido de vuelta" : "Crear cuenta"}
            </h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              {isLogin ? "Ingresa tus credenciales para continuar" : "Empieza a mejorar tu alimentación hoy"}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200/80 rounded-xl flex items-start gap-2.5 animate-slide-down">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-2.5 animate-slide-down">
              <CheckCircleIcon />
              <p className="text-sm text-emerald-700">{success}</p>
            </div>
          )}

          {/* Google button */}
          <button
            onClick={() => googleLogin()}
            disabled={googleLoading || loading}
            className="btn-google mb-3"
          >
            {googleLoading ? <SpinnerIcon /> : <GoogleIcon />}
            <span>{googleLoading ? "Conectando con Google..." : "Continuar con Google"}</span>
          </button>

          {/* Divider */}
          <div className="divider-or">
            <span className="text-xs text-slate-400 font-medium px-3">o con tu correo</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            {!isLogin && (
              <div className="animate-slide-down">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre completo</label>
                <input
                  type="text"
                  value={form.nombreCompleto}
                  onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
                  className="input-premium"
                  placeholder="Ej: María García López"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-premium"
                placeholder="correo@ejemplo.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-premium pr-12"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || googleLoading} className="btn-primary mt-1">
              {loading ? (
                <><SpinnerIcon /> Procesando...</>
              ) : isLogin ? (
                <>
                  Ingresar
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              ) : "Crear cuenta"}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-slate-500 text-sm mt-6">
            {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button onClick={toggleMode} className="text-[#0057B8] font-semibold hover:underline transition-colors">
              {isLogin ? "Regístrate gratis" : "Inicia sesión"}
            </button>
          </p>

          {/* Security note */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Datos protegidos con encriptación SSL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
