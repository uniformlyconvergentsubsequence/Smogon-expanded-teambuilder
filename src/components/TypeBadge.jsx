import { TYPE_COLORS } from '../data/typeChart';

export default function TypeBadge({ type, size = 'sm', className = '' }) {
  if (!type) return null;

  const colors = TYPE_COLORS[type] || { bg: '#666', text: '#fff' };

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wider whitespace-nowrap
                  ${sizeClasses[size] || sizeClasses.sm} ${className}`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {type}
    </span>
  );
}

export function TypeBadgeRow({ types = [], size = 'sm', className = '' }) {
  if (!types || types.length === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {types.map(type => (
        <TypeBadge key={type} type={type} size={size} />
      ))}
    </div>
  );
}
