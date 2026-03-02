import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTeam } from '../context/TeamContext';
import { fetchChaosData, getPokemonFromChaos } from '../services/smogonApi';
import { getPokemonData } from '../services/showdownData';
import { TypeBadgeRow } from '../components/TypeBadge';
import TypeBadge from '../components/TypeBadge';
import { BaseStatBar } from '../components/StatBar';
import StatBar from '../components/StatBar';
import LoadingSpinner from '../components/LoadingSpinner';
import FormatSelector from '../components/FormatSelector';
import { getSmogonDexUrl } from '../data/formats';
import { getTypeMatchups, TYPE_LIST } from '../data/typeChart';
import { getEffectivenessClass, getEffectivenessLabel, parseSpread, sortByValue } from '../utils/helpers';

export default function PokemonDetail() {
  const { pokemon: pokemonParam } = useParams();
  const { format, formatId } = useApp();
  const { setPokemon } = useTeam();
  const [chaosData, setChaosData] = useState(null);
  const [pokemonInfo, setPokemonInfo] = useState(null);
  const [showdownData, setShowdownData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [addedToTeam, setAddedToTeam] = useState(false);

  const pokemonName = decodeURIComponent(pokemonParam || '');

  // Fetch chaos data and showdown data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setAddedToTeam(false);

      try {
        const [chaos, sdData] = await Promise.allSettled([
          fetchChaosData(format.month, formatId, format.rating),
          getPokemonData(pokemonName),
        ]);

        if (cancelled) return;

        if (sdData.status === 'fulfilled') {
          setShowdownData(sdData.value);
        }

        if (chaos.status === 'fulfilled') {
          setChaosData(chaos.value);
          const info = getPokemonFromChaos(chaos.value, pokemonName);
          setPokemonInfo(info);
          if (!info) setError('Pokémon not found in the current format/month. Try a different format.');
        } else {
          setError('Failed to load stats data for this format.');
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [pokemonName, format.month, formatId, format.rating]);

  const smogonUrl = getSmogonDexUrl(pokemonName, format.gen);
  const spriteUrl = `https://play.pokemonshowdown.com/sprites/dex/${pokemonName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
  const types = showdownData?.types || [];
  const baseStats = showdownData?.baseStats || null;
  const bst = baseStats ? Object.values(baseStats).reduce((a, b) => a + b, 0) : 0;

  // Type matchups
  const typeMatchups = useMemo(() => {
    if (types.length === 0) return null;
    return getTypeMatchups(types);
  }, [types]);

  // Add a top set to team builder
  function addToTeam() {
    if (!pokemonInfo) return;

    const topAbility = sortByValue(pokemonInfo.Abilities || {})[0]?.[0] || '';
    const topItem = sortByValue(pokemonInfo.Items || {})[0]?.[0] || '';
    const topMoves = sortByValue(pokemonInfo.Moves || {}).slice(0, 4).map(([name]) => name);
    const topSpread = sortByValue(pokemonInfo.Spreads || {})[0]?.[0] || '';
    const spread = parseSpread(topSpread);
    const topTera = pokemonInfo['Tera Types'] ? sortByValue(pokemonInfo['Tera Types'])[0]?.[0] || '' : '';

    const newPokemon = {
      species: pokemonName,
      nickname: '',
      item: topItem,
      ability: topAbility,
      nature: spread?.nature || '',
      teraType: topTera,
      level: 100,
      shiny: false,
      gender: '',
      evs: spread?.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      moves: [topMoves[0] || '', topMoves[1] || '', topMoves[2] || '', topMoves[3] || ''],
    };

    // Find first empty slot
    setPokemon(0, newPokemon);
    setAddedToTeam(true);
    setTimeout(() => setAddedToTeam(false), 2000);
  }

  const SECTIONS = [
    { id: 'overview', label: 'Overview' },
    { id: 'moves', label: 'Moves' },
    { id: 'items', label: 'Items & Abilities' },
    { id: 'spreads', label: 'Spreads' },
    { id: 'teammates', label: 'Teammates' },
    { id: 'counters', label: 'Checks & Counters' },
  ];

  if (loading) return <LoadingSpinner fullScreen text={`Loading ${pokemonName}...`} />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/stats" className="text-slate-400 hover:text-white transition-colors">Stats Explorer</Link>
        <span className="text-slate-600">→</span>
        <span className="text-white font-medium">{pokemonName}</span>
      </div>

      <FormatSelector compact className="mb-6" />

      {error && (
        <div className="glass-panel p-6 text-center mb-6">
          <p className="text-amber-400 mb-2">⚠️ {error}</p>
          <p className="text-sm text-slate-500">Try changing the format, month, or rating above.</p>
        </div>
      )}

      {/* Header */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <img
            src={spriteUrl}
            alt={pokemonName}
            className="w-28 h-28 object-contain drop-shadow-lg"
            onError={e => { e.target.style.opacity = '0.3'; }}
          />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{pokemonName}</h1>
            <TypeBadgeRow types={types} size="md" className="mb-3" />
            {pokemonInfo && (
              <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                <span>Usage: <strong className="text-white">{(pokemonInfo.usage * 100).toFixed(2)}%</strong></span>
                <span>Raw: <strong className="text-white">{(pokemonInfo['Raw count'] || 0).toLocaleString()}</strong></span>
                {pokemonInfo['Viability Ceiling'] && (
                  <span>Viability: <strong className="text-white">{pokemonInfo['Viability Ceiling'][0]}</strong></span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={smogonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Smogon Dex
            </a>
            <button
              onClick={addToTeam}
              disabled={!pokemonInfo}
              className={`btn-primary text-sm ${addedToTeam ? '!bg-emerald-600' : ''}`}
            >
              {addedToTeam ? '✓ Added!' : '+ Add to Team'}
            </button>
          </div>
        </div>

        {/* Base Stats */}
        {baseStats && (
          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              Base Stats <span className="text-slate-500 font-normal">(BST: {bst})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
              <BaseStatBar label="HP" value={baseStats.hp} />
              <BaseStatBar label="Atk" value={baseStats.atk} />
              <BaseStatBar label="Def" value={baseStats.def} />
              <BaseStatBar label="SpA" value={baseStats.spa} />
              <BaseStatBar label="SpD" value={baseStats.spd} />
              <BaseStatBar label="Spe" value={baseStats.spe} />
            </div>
          </div>
        )}
      </div>

      {/* Type Matchups */}
      {typeMatchups && (
        <div className="glass-panel p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Defensive Type Matchups</h3>
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
            {TYPE_LIST.map(type => {
              const mult = typeMatchups[type];
              return (
                <div
                  key={type}
                  className={`rounded-lg p-2 text-center ${getEffectivenessClass(mult)}`}
                  title={`${type}: ${getEffectivenessLabel(mult)}`}
                >
                  <div className="text-[10px] font-semibold uppercase mb-0.5">{type.slice(0, 3)}</div>
                  <div className="text-xs font-bold">{getEffectivenessLabel(mult)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      {pokemonInfo && (
        <>
          {/* Section tabs */}
          <div className="flex flex-wrap gap-1 mb-6 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all
                  ${activeSection === s.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Moves */}
            {(activeSection === 'overview' || activeSection === 'moves') && pokemonInfo.Moves && (
              <DataSection title="🎯 Moves" data={pokemonInfo.Moves} color="blue" />
            )}

            {/* Abilities */}
            {(activeSection === 'overview' || activeSection === 'items') && pokemonInfo.Abilities && (
              <DataSection title="⚡ Abilities" data={pokemonInfo.Abilities} color="violet" />
            )}

            {/* Items */}
            {(activeSection === 'overview' || activeSection === 'items') && pokemonInfo.Items && (
              <DataSection title="🎒 Items" data={pokemonInfo.Items} color="amber" />
            )}

            {/* Tera Types */}
            {(activeSection === 'overview' || activeSection === 'items') && pokemonInfo['Tera Types'] && (
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-white mb-4 text-sm">✨ Tera Types</h3>
                <div className="space-y-2">
                  {sortByValue(pokemonInfo['Tera Types']).slice(0, 10).map(([name, value]) => (
                    <div key={name} className="flex items-center gap-3">
                      <TypeBadge type={name} size="xs" className="w-20" />
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${value * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-300 w-14 text-right">
                        {(value * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spreads */}
            {(activeSection === 'overview' || activeSection === 'spreads') && pokemonInfo.Spreads && (
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-white mb-4 text-sm">📊 EV Spreads</h3>
                <div className="space-y-2.5">
                  {sortByValue(pokemonInfo.Spreads).slice(0, 8).map(([spread, value]) => {
                    const parsed = parseSpread(spread);
                    return (
                      <div key={spread} className="bg-slate-800/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">{parsed?.nature || 'Unknown'} Nature</span>
                          <span className="text-xs font-mono text-blue-400">{(value * 100).toFixed(1)}%</span>
                        </div>
                        {parsed?.evs && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 font-mono">
                            {Object.entries(parsed.evs)
                              .filter(([, v]) => v > 0)
                              .map(([stat, v]) => (
                                <span key={stat}>{v} {stat.toUpperCase()}</span>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Teammates */}
            {(activeSection === 'overview' || activeSection === 'teammates') && pokemonInfo.Teammates && (
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-white mb-4 text-sm">🤝 Common Teammates</h3>
                <div className="space-y-2">
                  {sortByValue(pokemonInfo.Teammates).slice(0, 12).map(([name, value]) => (
                    <Link
                      key={name}
                      to={`/stats/${encodeURIComponent(name)}`}
                      className="flex items-center gap-3 group hover:bg-slate-800/40 rounded-lg p-1.5 -mx-1.5 transition-colors"
                    >
                      <img
                        src={`https://play.pokemonshowdown.com/sprites/dex/${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                        alt={name}
                        className="w-8 h-8 object-contain"
                        loading="lazy"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors flex-1">{name}</span>
                      <span className={`text-xs font-mono ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {value >= 0 ? '+' : ''}{(value * 100).toFixed(1)}%
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Checks & Counters */}
            {(activeSection === 'overview' || activeSection === 'counters') && pokemonInfo['Checks and Counters'] && (
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-white mb-4 text-sm">🛡️ Checks & Counters</h3>
                <div className="space-y-2">
                  {Object.entries(pokemonInfo['Checks and Counters'])
                    .sort(([, a], [, b]) => (b[0] || 0) - (a[0] || 0))
                    .slice(0, 12)
                    .map(([name, data]) => {
                      const [koed, switched, unknown] = Array.isArray(data) ? data : [0, 0, 0];
                      return (
                        <Link
                          key={name}
                          to={`/stats/${encodeURIComponent(name)}`}
                          className="flex items-center gap-3 group hover:bg-slate-800/40 rounded-lg p-1.5 -mx-1.5 transition-colors"
                        >
                          <img
                            src={`https://play.pokemonshowdown.com/sprites/dex/${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                            alt={name}
                            className="w-8 h-8 object-contain"
                            loading="lazy"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                          <span className="text-sm text-slate-300 group-hover:text-white transition-colors flex-1">{name}</span>
                          <div className="text-right">
                            <span className="text-xs font-mono text-red-400">{koed?.toFixed(1)}%</span>
                            <span className="text-xs text-slate-600 mx-1">KO'd</span>
                          </div>
                        </Link>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DataSection({ title, data, color = 'blue', maxItems = 15 }) {
  const sorted = sortByValue(data);
  const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

  return (
    <div className="glass-panel p-5">
      <h3 className="font-semibold text-white mb-4 text-sm">{title}</h3>
      <div className="space-y-1.5">
        {sorted.slice(0, maxItems).map(([name, value]) => (
          <StatBar
            key={name}
            label={name}
            value={value}
            maxValue={maxVal}
            color={color}
          />
        ))}
      </div>
    </div>
  );
}
