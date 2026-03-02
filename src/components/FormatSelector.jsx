import { useApp } from '../context/AppContext';
import { GENERATIONS, TIERS, RATING_CUTOFFS, getAvailableMonths } from '../data/formats';

export default function FormatSelector({ compact = false, className = '' }) {
  const { format, setGen, setTier, setMonth, setRating, filteredRatingCutoffs, ratingsLoading } = useApp();
  const months = getAvailableMonths();

  // Use filtered ratings if available, otherwise fall back to all
  const ratingOptions = filteredRatingCutoffs && filteredRatingCutoffs.length > 0
    ? filteredRatingCutoffs
    : RATING_CUTOFFS;

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <select
          value={format.gen}
          onChange={e => setGen(Number(e.target.value))}
          className="select-field !w-auto text-xs"
        >
          {GENERATIONS.map(g => (
            <option key={g.id} value={g.id}>{g.short}</option>
          ))}
        </select>

        <select
          value={format.tier}
          onChange={e => setTier(e.target.value)}
          className="select-field !w-auto text-xs"
        >
          {TIERS.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          value={format.month}
          onChange={e => setMonth(e.target.value)}
          className="select-field !w-auto text-xs"
        >
          {months.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select
          value={format.rating}
          onChange={e => setRating(e.target.value)}
          className={`select-field !w-auto text-xs ${ratingsLoading ? 'opacity-50' : ''}`}
          disabled={ratingsLoading}
        >
          {ratingOptions.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={`glass-panel p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
        Format Settings
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Generation</label>
          <select
            value={format.gen}
            onChange={e => setGen(Number(e.target.value))}
            className="select-field text-sm"
          >
            {GENERATIONS.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Tier</label>
          <select
            value={format.tier}
            onChange={e => setTier(e.target.value)}
            className="select-field text-sm"
          >
            {TIERS.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Month</label>
          <select
            value={format.month}
            onChange={e => setMonth(e.target.value)}
            className="select-field text-sm"
          >
            {months.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Rating {ratingsLoading && <span className="text-slate-500 ml-1">(loading...)</span>}
          </label>
          <select
            value={format.rating}
            onChange={e => setRating(e.target.value)}
            className={`select-field text-sm ${ratingsLoading ? 'opacity-50' : ''}`}
            disabled={ratingsLoading}
          >
            {ratingOptions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Viewing:{' '}
        <span className="text-slate-300 font-mono">
          gen{format.gen}{format.tier}
        </span>
        {' · '}
        <span className="text-slate-300">{format.month}</span>
        {' · '}
        <span className="text-slate-300">
          {ratingOptions.find(r => r.id === format.rating)?.name || format.rating}
        </span>
      </div>
    </div>
  );
}
