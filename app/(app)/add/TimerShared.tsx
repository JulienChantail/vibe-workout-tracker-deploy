'use client';

import { useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';

const KEEP_ALIVE_KEY = 'vwt.keepAnnouncementsInBackground';

/** Réglage mémorisé sur le téléphone : garder les annonces quand on change d'appli. */
export function useKeepAliveSetting(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      return typeof window === 'undefined' || window.localStorage.getItem(KEEP_ALIVE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const update = (next: boolean) => {
    setValue(next);
    try {
      window.localStorage.setItem(KEEP_ALIVE_KEY, String(next));
    } catch {
      // stockage indisponible (navigation privée) : le réglage ne sera pas mémorisé
    }
  };
  return [value, update];
}

export function KeepAliveOption({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-cyan-500" />
      <span>
        Garder les annonces si je change d&apos;appli (Android)
        <span className="block text-gray-500">Si ta musique se met en pause pendant le chrono, décoche cette case.</span>
      </span>
    </label>
  );
}

/** Écran plein écran (sans le menu de l'appli) pendant le chrono. */
export function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#050508] overflow-y-auto text-white">
      <div className="max-w-md mx-auto min-h-full px-5 pt-6 pb-8 flex flex-col">{children}</div>
    </div>
  );
}

/** Barre du haut : petit libellé à gauche, bouton pause discret à droite. */
export function TimerTopBar({
  label,
  paused,
  disabled,
  onPause,
  onResume,
}: {
  label: string;
  paused: boolean;
  disabled: boolean;
  onPause: () => void;
  onResume: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs tracking-wide text-gray-500">{label}</span>
      <button
        type="button"
        onClick={paused ? onResume : onPause}
        disabled={disabled}
        aria-label={paused ? 'Reprendre' : 'Pause'}
        className={`w-10 h-10 rounded-full border flex items-center justify-center disabled:opacity-30 ${
          paused ? 'border-cyan-400 text-cyan-300' : 'border-[#3a3a44] text-gray-400'
        }`}
      >
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>
    </div>
  );
}

export function RoundButton({
  onClick,
  disabled,
  primary,
  color,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  color: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-16 h-16 rounded-full flex items-center justify-center text-4xl font-light disabled:opacity-30 active:scale-95 transition-transform"
      style={primary ? { backgroundColor: color, color: '#111' } : { backgroundColor: '#2a2a31', color: '#ddd' }}
    >
      {children}
    </button>
  );
}
