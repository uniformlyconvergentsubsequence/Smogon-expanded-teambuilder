export default function StatBar({ label, value, maxValue = 1, color = 'blue', showPercent = true, className = '' }) {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    yellow: 'bg-amber-500',
    violet: 'bg-violet-500',
    orange: 'bg-orange-500',
    cyan: 'bg-cyan-500',
    pink: 'bg-pink-500',
    slate: 'bg-slate-500',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {label && (
        <span className="text-sm text-slate-400 w-28 truncate flex-shrink-0" title={label}>
          {label}
        </span>
      )}
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colorClasses[color] || colorClasses.blue}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercent && (
        <span className="text-sm font-mono text-slate-300 w-16 text-right flex-shrink-0">
          {typeof value === 'number'
            ? value <= 1
              ? (value * 100).toFixed(1) + '%'
              : value.toFixed(1) + '%'
            : value}
        </span>
      )}
    </div>
  );
}

export function BaseStatBar({ label, value, className = '' }) {
  // Base stat coloring: red < 60, orange < 80, yellow < 100, green < 120, blue >= 120
  let color = 'red';
  if (value >= 120) color = 'cyan';
  else if (value >= 100) color = 'green';
  else if (value >= 80) color = 'yellow';
  else if (value >= 60) color = 'orange';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-slate-400 w-10 flex-shrink-0 uppercase">{label}</span>
      <span className="text-xs font-mono text-slate-300 w-8 text-right flex-shrink-0">{value}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            color === 'red' ? 'bg-red-500' :
            color === 'orange' ? 'bg-orange-500' :
            color === 'yellow' ? 'bg-amber-500' :
            color === 'green' ? 'bg-emerald-500' :
            'bg-cyan-500'
          }`}
          style={{ width: `${Math.min((value / 255) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
