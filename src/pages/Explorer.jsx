import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { fetchChaosData, fetchUsageStats, fetchLeadsStats, fetchMetagameStats, getUsageListFromChaos, fetchMonotypeChaosData, extractMonotypeUsage } from '../services/smogonApi';
import { getPokemonTypes } from '../services/showdownData';
import { isMonotypeFormat, hasMonotypeTypeData, getMonotypeFormatId, ALL_TYPES } from '../data/formats';
import FormatSelector from '../components/FormatSelector';
import TypeBadge, { TypeBadgeRow } from '../components/TypeBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import StatBar from '../components/StatBar';
import { formatPercent, toSlug, debounce } from '../utils/helpers';

const TABS = [
  { id: 'usage', label: 'Usage Rankings', icon: '📊' },
  { id: 'leads', label: 'Leads', icon: '🏁' },
  { id: 'metagame', label: 'Metagame', icon: '🔬' },
];

export default function Explorer() {
  const { format, formatId, setGen, setTier } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('usage');
  const [chaosData, setChaosData] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [leadsData, setLeadsData] = useState(null);
  const [metagameData, setMetagameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pokemonTypes, setPokemonTypes] = useState({});

  // Monotype state
  const isMonotype = isMonotypeFormat(formatId);
  const hasTypeData = hasMonotypeTypeData(formatId);
  const [selectedMonoType, setSelectedMonoType] = useState(null); // null = show overall/type-usage overview
  const [monoTypeLoading, setMonoTypeLoading] = useState(false);
  const [typeUsageList, setTypeUsageList] = useState([]); // type usage from metagame data

  // Reset monotype selection when format changes
  useEffect(() => {
    setSelectedMonoType(null);
    setTypeUsageList([]);
  }, [formatId]);

  // Apply search params on mount
  useEffect(() => {
    const gen = searchParams.get('gen');
    const tier = searchParams.get('tier');
    if (gen) setGen(Number(gen));
    if (tier) setTier(tier);
  }, []);

  // Fetch data when format changes (or monotype selection changes)
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        if (hasTypeData && selectedMonoType) {
          // Fetch per-type monotype data
          const typedFormat = getMonotypeFormatId(formatId, selectedMonoType);
          const [chaos, usage] = await Promise.allSettled([
            fetchMonotypeChaosData(format.month, typedFormat, format.rating),
            fetchUsageStats(format.month, typedFormat, format.rating).catch(() =>
              // Try the monotype subdirectory too
              fetchUsageStats(format.month, `monotype/${typedFormat}`, format.rating)
            ),
          ]);

          if (cancelled) return;

          if (chaos.status === 'fulfilled') {
            setChaosData(chaos.value);
          } else {
            setChaosData(null);
          }
          if (usage.status === 'fulfilled') {
            setUsageData(usage.value);
          } else {
            setUsageData(null);
          }

          if (chaos.status === 'rejected' && usage.status === 'rejected') {
            setError(`No data available for ${selectedMonoType} monotype.`);
          }
        } else {
          // Fetch normal data (or overall monotype data)
          const [chaos, usage] = await Promise.allSettled([
            fetchChaosData(format.month, formatId, format.rating),
            fetchUsageStats(format.month, formatId, format.rating),
          ]);

          if (cancelled) return;

          if (chaos.status === 'fulfilled') {
            setChaosData(chaos.value);
          } else {
            setChaosData(null);
          }
          if (usage.status === 'fulfilled') {
            setUsageData(usage.value);
          } else {
            setUsageData(null);
          }

          if (chaos.status === 'rejected' && usage.status === 'rejected') {
            setError('Failed to fetch stats data. The format/month combination may not be available.');
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [format.month, formatId, format.rating, selectedMonoType, hasTypeData]);

  // Fetch metagame data (for type usage percentages) when monotype format is selected
  useEffect(() => {
    if (!isMonotype) return;
    fetchMetagameStats(format.month, formatId, format.rating)
      .then(data => {
        setMetagameData(data);
        const typeUsage = extractMonotypeUsage(data);
        setTypeUsageList(typeUsage);
      })
      .catch(() => {});
  }, [isMonotype, format.month, formatId, format.rating]);

  // Fetch leads and metagame when those tabs are active (non-monotype or no type selected)
  useEffect(() => {
    if (activeTab === 'leads' && !leadsData) {
      const leadsFormat = (hasTypeData && selectedMonoType)
        ? getMonotypeFormatId(formatId, selectedMonoType)
        : formatId;
      fetchLeadsStats(format.month, leadsFormat, format.rating)
        .then(setLeadsData)
        .catch(() => {});
    }
    if (activeTab === 'metagame' && !metagameData) {
      fetchMetagameStats(format.month, formatId, format.rating)
        .then(setMetagameData)
        .catch(() => {});
    }
  }, [activeTab, format.month, formatId, format.rating, selectedMonoType, hasTypeData]);

  // Reset loaded data when format or monotype selection changes
  useEffect(() => {
    setLeadsData(null);
    // Only reset metagame if format changes (not monotype selection)
  }, [format.month, formatId, format.rating]);

  useEffect(() => {
    setLeadsData(null);
  }, [selectedMonoType]);

  // Get usage list from chaos data
  const usageList = useMemo(() => {
    if (chaosData) return getUsageListFromChaos(chaosData);
    if (usageData) return usageData.pokemon || [];
    return [];
  }, [chaosData, usageData]);

  // Filter by search
  const filteredList = useMemo(() => {
    if (!searchQuery) return usageList;
    const q = searchQuery.toLowerCase();
    return usageList.filter(p => p.name.toLowerCase().includes(q));
  }, [usageList, searchQuery]);

  // Fetch types for visible Pokemon
  useEffect(() => {
    const fetchTypes = async () => {
      const visible = filteredList.slice(0, 50);
      const newTypes = { ...pokemonTypes };
      let changed = false;

      for (const p of visible) {
        if (!newTypes[p.name]) {
          try {
            const types = await getPokemonTypes(p.name);
            if (types.length > 0) {
              newTypes[p.name] = types;
              changed = true;
            }
          } catch (e) {}
        }
      }

      if (changed) setPokemonTypes(newTypes);
    };

    fetchTypes();
  }, [filteredList]);

  const debouncedSearch = useCallback(debounce((value) => setSearchQuery(value), 200), []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Stats Explorer</h1>
        <p className="text-sm text-slate-400">
          Browse competitive Pokémon usage statistics, movesets, leads, and metagame data.
        </p>
      </div>

      <FormatSelector className="mb-6" />

      {/* Monotype Type Selector */}
      {isMonotype && (
        <div className="mb-6 glass-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              🏷️ Monotype Filter
            </h3>
            {selectedMonoType && (
              <button
                onClick={() => setSelectedMonoType(null)}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                ✕ Clear selection
              </button>
            )}
          </div>
          {!hasTypeData && (
            <p className="text-xs text-slate-500 mb-2">
              Per-type usage data is only available for Gen 9 Monotype. Showing type popularity overview only.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {ALL_TYPES.map(type => {
              const typeUsage = typeUsageList.find(t => t.type.toLowerCase() === type.toLowerCase());
              const isSelected = selectedMonoType === type;
              return (
                <button
                  key={type}
                  onClick={() => hasTypeData && setSelectedMonoType(isSelected ? null : type)}
                  disabled={!hasTypeData}
                  className={`relative group transition-all duration-200 rounded-lg
                    ${hasTypeData ? 'cursor-pointer hover:scale-105' : 'cursor-default opacity-80'}
                    ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105' : ''}`}
                >
                  <TypeBadge type={type} size="md" />
                  {typeUsage && (
                    <span className={`block text-[10px] mt-0.5 text-center font-mono
                      ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                      {typeUsage.usage.toFixed(1)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedMonoType && (
            <p className="text-xs text-slate-400 mt-3">
              Showing usage stats for <span className="text-white font-medium">{selectedMonoType}</span> monotype teams
              {monoTypeLoading && ' — Loading...'}
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-slate-900/50 p-1 rounded-lg border border-slate-800 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner text="Fetching stats data..." />}

      {error && (
        <div className="glass-panel p-6 text-center">
          <p className="text-red-400 mb-2">⚠️ {error}</p>
          <p className="text-sm text-slate-500">
            Try a different format, month, or rating cutoff. Not all combinations have data available.
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {activeTab === 'usage' && (
            <UsageTab
              usageList={filteredList}
              chaosData={chaosData}
              pokemonTypes={pokemonTypes}
              searchQuery={searchQuery}
              onSearch={debouncedSearch}
              format={format}
              formatId={formatId}
            />
          )}
          {activeTab === 'leads' && (
            <LeadsTab leadsData={leadsData} pokemonTypes={pokemonTypes} format={format} formatId={formatId} />
          )}
          {activeTab === 'metagame' && (
            <MetagameTab metagameData={metagameData} />
          )}
        </>
      )}
    </div>
  );
}

function UsageTab({ usageList, chaosData, pokemonTypes, searchQuery, onSearch, format, formatId }) {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Reset page when search changes
  useEffect(() => { setPage(0); }, [searchQuery]);

  const paged = usageList.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(usageList.length / pageSize);
  const maxUsage = usageList.length > 0 ? usageList[0].usage : 1;

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search Pokémon..."
            className="input-field pl-10"
            onChange={e => onSearch(e.target.value)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          {usageList.length} Pokémon found
          {chaosData?.info?.['number of battles'] &&
            ` · ${chaosData.info['number of battles'].toLocaleString()} battles analyzed`}
        </p>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-12">#</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Pokémon</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Usage</th>
                <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Raw Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paged.map((pokemon) => (
                <tr key={pokemon.name} className="group hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-2.5 text-sm text-slate-500 font-mono">{pokemon.rank}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/stats/${encodeURIComponent(pokemon.name)}`}
                      className="flex items-center gap-3 group/link"
                    >
                      <img
                        src={`https://play.pokemonshowdown.com/sprites/dex/${pokemon.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                        alt={pokemon.name}
                        className="w-10 h-10 object-contain"
                        loading="lazy"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      <span className="font-medium text-white group-hover/link:text-blue-400 transition-colors">
                        {pokemon.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <TypeBadgeRow types={pokemonTypes[pokemon.name] || []} size="xs" />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-[160px]">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${(pokemon.usage / maxUsage) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-slate-300 w-16 text-right">
                        {(pokemon.usage * 100).toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-slate-400 font-mono hidden md:table-cell">
                    {(pokemon.rawCount || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function LeadsTab({ leadsData, pokemonTypes, format, formatId }) {
  if (!leadsData) return <LoadingSpinner text="Fetching leads data..." />;
  if (!leadsData.pokemon || leadsData.pokemon.length === 0) {
    return <div className="glass-panel p-6 text-center text-slate-400">No leads data available for this format.</div>;
  }

  const maxUsage = leadsData.pokemon[0]?.usage || 1;

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">
        {leadsData.pokemon.length} leads found
        {leadsData.totalBattles > 0 && ` · ${leadsData.totalBattles.toLocaleString()} battles`}
      </p>

      <div className="glass-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-12">#</th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Pokémon</th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Lead Usage</th>
              <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Raw</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {leadsData.pokemon.slice(0, 50).map((pokemon) => (
              <tr key={pokemon.name} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-2.5 text-sm text-slate-500 font-mono">{pokemon.rank}</td>
                <td className="px-4 py-2.5">
                  <Link to={`/stats/${encodeURIComponent(pokemon.name)}`} className="flex items-center gap-3 group">
                    <img
                      src={`https://play.pokemonshowdown.com/sprites/dex/${pokemon.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                      alt={pokemon.name}
                      className="w-10 h-10 object-contain"
                      loading="lazy"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                      {pokemon.name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-[160px]">
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${(pokemon.usage / maxUsage) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-slate-300 w-16 text-right">
                      {(pokemon.usage * 100).toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-sm text-slate-400 font-mono hidden md:table-cell">
                  {(pokemon.rawCount || pokemon.raw || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetagameTab({ metagameData }) {
  if (!metagameData) return <LoadingSpinner text="Fetching metagame data..." />;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Playstyles */}
      <div className="glass-panel p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          🎭 Playstyle Distribution
        </h3>
        {metagameData.playstyles.length > 0 ? (
          <div className="space-y-3">
            {metagameData.playstyles.map(({ name, usage }) => (
              <StatBar
                key={name}
                label={name}
                value={usage}
                maxValue={metagameData.playstyles[0].usage * 1.2}
                showPercent
                color={
                  name.toLowerCase().includes('stall') ? 'red' :
                  name.toLowerCase().includes('balance') ? 'green' :
                  name.toLowerCase().includes('offense') ? 'orange' :
                  name.toLowerCase().includes('hyper') ? 'yellow' :
                  'blue'
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No playstyle data available.</p>
        )}
      </div>

      {/* Stalliness */}
      <div className="glass-panel p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          📈 Stalliness
        </h3>
        <div className="text-center py-8">
          <p className="text-4xl font-bold text-gradient mb-2">
            {metagameData.stalliness.mean.toFixed(3)}
          </p>
          <p className="text-sm text-slate-400">Mean Stalliness Score</p>
          <p className="text-xs text-slate-500 mt-2">
            Negative = more offensive meta · Positive = more defensive meta
          </p>
        </div>
      </div>
    </div>
  );
}
