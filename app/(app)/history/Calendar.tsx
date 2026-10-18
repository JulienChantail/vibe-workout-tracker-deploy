'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export type DayEntry = { id: string; exerciseTypeName: string; colorClass: string };

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Calendar({
  month,
  onMonthChange,
  entriesByDay,
  selectedDay,
  onSelectDay,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  entriesByDay: Map<string, DayEntry[]>;
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstOfMonth = new Date(year, m, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toKey(new Date());

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange(new Date(year, m - 1, 1))}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="font-bold text-white">
          {MONTH_NAMES[m]} {year}
        </h3>
        <button
          onClick={() => onMonthChange(new Date(year, m + 1, 1))}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs text-gray-500 font-semibold py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} />;
          const key = toKey(date);
          const dayEntries = entriesByDay.get(key) ?? [];
          const isSelected = selectedDay === key;
          const isToday = key === todayKey;

          return (
            <button
              key={idx}
              onClick={() => onSelectDay(isSelected ? null : key)}
              className={`aspect-square rounded-lg p-1.5 flex flex-col items-center justify-start border transition-all ${
                isSelected
                  ? 'bg-cyan-600/30 border-cyan-400'
                  : dayEntries.length > 0
                    ? 'bg-white/10 border-white/20 hover:bg-white/15'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
              }`}
            >
              <span className={`text-xs ${isToday ? 'font-bold text-cyan-300' : 'text-gray-400'}`}>{date.getDate()}</span>
              <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                {dayEntries.slice(0, 4).map((e) => (
                  <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${e.colorClass}`} title={e.exerciseTypeName} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { toKey };
