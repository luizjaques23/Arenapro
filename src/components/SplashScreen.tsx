import { useEffect, useRef, useState } from 'react';
import { FutevoleiBall } from './FutevoleiBall';

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFadingOut(true), 1650);
    const doneTimer = window.setTimeout(() => onDoneRef.current(), 1950);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  const handleSkip = () => {
    setFadingOut(true);
    window.setTimeout(() => onDoneRef.current(), 180);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white px-6 cursor-pointer select-none transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Court boundary lines decoration */}
      <div className="absolute inset-5 sm:inset-8 border-2 border-emerald-400/20 rounded-3xl pointer-events-none" />
      <div className="absolute inset-x-5 sm:inset-x-8 top-1/2 h-0.5 bg-emerald-400/15 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-2 border-emerald-400/15 pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6 w-full max-w-xs">
        <div className="relative flex flex-col items-center">
          <div className="p-6 rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/40 shadow-2xl shadow-emerald-500/25">
            <FutevoleiBall className="w-24 h-24 animate-splash-ball" />
          </div>
          <div className="w-20 h-3 rounded-full bg-emerald-400/40 blur-[2px] mt-3 animate-splash-shadow" />
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.35em] text-emerald-400">
            ArenaPro
          </p>
          <h1 className="font-score text-5xl font-extrabold tracking-wide uppercase">
            Torneios Ao Vivo
          </h1>
          <p className="text-sm text-slate-400">
            Futevôlei • Quadra • Areia
          </p>
        </div>

        {/* Fast loading bar */}
        <div className="w-full space-y-2 pt-2">
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400 animate-splash-progress" />
          </div>
          <p className="text-[11px] font-semibold text-slate-500 text-center">
            Preparando quadra... (toque para entrar)
          </p>
        </div>
      </div>
    </div>
  );
}
