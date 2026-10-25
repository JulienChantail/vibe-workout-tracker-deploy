// Horloge du chrono (inspirée de SmartWOD Timer) :
// - graduations extérieures : temps écoulé dans l'intervalle en cours ;
// - point blanc en bas : le "halfway there" ;
// - anneau intérieur : un segment par intervalle sur toute la durée.

function polar(r: number, fraction: number): [number, number] {
  const a = fraction * 2 * Math.PI - Math.PI / 2;
  return [160 + r * Math.cos(a), 160 + r * Math.sin(a)];
}

function arc(from: number, to: number) {
  const [x1, y1] = polar(118, from);
  const [x2, y2] = polar(118, to);
  return `M ${x1} ${y1} A 118 118 0 ${to - from > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
}

export default function TimerClock({
  color,
  progress,
  segments,
  segmentsDone,
  big,
  label,
  total,
}: {
  color: string;
  progress: number; // 0 à 1 dans l'intervalle en cours
  segments: number;
  segmentsDone: number;
  big: string;
  label: string;
  total: string; // temps total restant
}) {
  const p = Math.min(1, Math.max(0, progress));
  const gap = segments > 1 ? Math.min(0.012, 0.3 / segments) : 0;
  const [dotX, dotY] = polar(145, p);
  const [halfX, halfY] = polar(158, 0.5);

  return (
    <div className="relative w-full max-w-[320px] aspect-square mx-auto">
      <svg viewBox="0 0 320 320" className="absolute inset-0 w-full h-full" aria-hidden="true">
        {Array.from({ length: 60 }, (_, i) => {
          const f = i / 60;
          const long = i % 5 === 0;
          const [x1, y1] = polar(long ? 132 : 138, f);
          const [x2, y2] = polar(152, f);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={f < p ? color : '#2c2c34'} strokeWidth={long ? 4 : 3} strokeLinecap="round" />
          );
        })}
        <circle cx={halfX} cy={halfY} r={4} fill="#fff" />
        {segments > 1 ? (
          Array.from({ length: segments }, (_, i) => {
            const a = i / segments + gap / 2;
            const b = (i + 1) / segments - gap / 2;
            const fill = i < segmentsDone ? b : i === segmentsDone ? a + (b - a) * p : a;
            return (
              <g key={i}>
                <path d={arc(a, b)} fill="none" stroke="#24242b" strokeWidth={5} strokeLinecap="round" />
                {fill > a && <path d={arc(a, fill)} fill="none" stroke={color} strokeOpacity={0.67} strokeWidth={5} strokeLinecap="round" />}
              </g>
            );
          })
        ) : (
          <>
            <circle cx={160} cy={160} r={118} fill="none" stroke="#24242b" strokeWidth={5} />
            {p > 0 && <path d={arc(0, Math.min(p, 0.9999))} fill="none" stroke={color} strokeOpacity={0.67} strokeWidth={5} strokeLinecap="round" />}
          </>
        )}
        <circle cx={dotX} cy={dotY} r={7} fill={color} stroke="#050508" strokeWidth={3} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-7xl font-extralight leading-none [font-variant-numeric:tabular-nums]" style={{ color }}>
          {big}
        </div>
        <div className="text-sm text-gray-400 mt-1">{label}</div>
        <div className="text-xl font-light text-gray-200 mt-3 [font-variant-numeric:tabular-nums]">
          {total}
          <span className="text-xs text-gray-500 ml-1">restantes</span>
        </div>
      </div>
    </div>
  );
}
