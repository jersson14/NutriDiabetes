'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center gradient-login">
      <div className="text-center animate-scale-in">
        <div className="relative inline-block">
          <div className="w-24 h-24 gradient-hero rounded-3xl flex items-center justify-center shadow-2xl animate-float">
            <span className="text-5xl">🍎</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <h1 className="text-white text-2xl font-bold mt-6" style={{fontFamily: 'Outfit, sans-serif'}}>NutriDiabetes</h1>
        <p className="text-blue-200/60 mt-2 text-sm">Cargando tu experiencia...</p>
        <div className="mt-6 flex justify-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{animationDelay: '0s'}} />
          <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{animationDelay: '0.1s'}} />
          <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{animationDelay: '0.2s'}} />
        </div>
      </div>
    </div>
  );
}
