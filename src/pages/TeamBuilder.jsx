import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTeam } from '../context/TeamContext';
import { useApp } from '../context/AppContext';
import { exportTeamToShowdown, importTeamFromShowdown, createEmptyPokemon, createEmptyTeam } from '../utils/exportShowdown';
import { fetchChaosData, getPokemonFromChaos, getUsageListFromChaos, fetchMonotypeChaosData } from '../services/smogonApi';
import { getPokemonTypes, formatMoveName, formatItemName, formatAbilityName, formatTypeName, fetchMoves } from '../services/showdownData';
import { TypeBadgeRow } from '../components/TypeBadge';
import TypeBadge from '../components/TypeBadge';
import FormatSelector from '../components/FormatSelector';
import { ALL_TYPES, isMonotypeFormat, hasMonotypeTypeData, getMonotypeFormatId, getSmogonDexUrl, TIERS } from '../data/formats';
import { generateTypeMatrix, calculateSynergyScore, getTeamWeaknesses } from '../utils/typeAnalysis';
import { getEffectivenessClass, getEffectivenessLabel, sortByValue, parseSpread } from '../utils/helpers';

export default function TeamBuilder() {
  const {
    teams, currentTeamIndex, currentTeam,
    setPokemon, clearSlot, setTeamName, addTeam, deleteTeam, selectTeam, importTeam
  } = useTeam();
  const { format, formatId } = useApp();
  const [editingSlot, setEditingSlot] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [teamTypes, setTeamTypes] = useState({});

  // Chaos data for the current format
  const [chaosData, setChaosData] = useState(null);
  const [chaosLoading, setChaosLoading] = useState(false);

  // Monotype state
  const isMonotype = isMonotypeFormat(formatId);
  const hasTypeData = hasMonotypeTypeData(formatId);
  const [selectedMonoType, setSelectedMonoType] = useState(null);

  // Reset monotype selection when format changes
  useEffect(() => {
    setSelectedMonoType(null);
  }, [formatId]);

  // Fetch chaos data for the selected format (or per-type for monotype)
  useEffect(() => {
    let cancelled = false;
    setChaosLoading(true);

    const fetchPromise = (hasTypeData && selectedMonoType)
      ? fetchMonotypeChaosData(format.month, getMonotypeFormatId(formatId, selectedMonoType), format.rating)
      : fetchChaosData(format.month, formatId, format.rating);

    fetchPromise
      .then(data => {
        if (!cancelled) setChaosData(data);
      })
      .catch(() => {
        if (!cancelled) setChaosData(null);
      })
      .finally(() => {
        if (!cancelled) setChaosLoading(false);
      });
    return () => { cancelled = true; };
  }, [format.month, formatId, format.rating, selectedMonoType, hasTypeData]);

  // Fetch types for team members
  useEffect(() => {
    async function loadTypes() {
      const newTypes = { ...teamTypes };
      let changed = false;
      for (const slot of currentTeam.pokemon) {
        if (slot.species && !newTypes[slot.species]) {
          try {
            const types = await getPokemonTypes(slot.species);
            if (types.length > 0) {
              newTypes[slot.species] = types;
              changed = true;
            }
          } catch (e) {}
        }
      }
      if (changed) setTeamTypes(newTypes);
    }
    loadTypes();
  }, [currentTeam.pokemon]);

  const teamMembers = currentTeam.pokemon
    .filter(p => p.species)
    .map(p => ({
      species: p.species,
      types: teamTypes[p.species] || [],
    }));

  const synergyScore = teamMembers.length >= 2 ? calculateSynergyScore(teamMembers) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Team Builder</h1>
          <p className="text-sm text-slate-400">
            Build a team for <span className="text-blue-400 font-medium">{formatId}</span> — suggestions powered by usage stats.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="btn-ghost text-sm">Import</button>
          <button onClick={() => setShowExport(true)} className="btn-ghost text-sm">Export</button>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`btn-ghost text-sm ${showAnalysis ? 'bg-slate-800 text-white' : ''}`}
          >
            Analysis
          </button>
        </div>
      </div>

      {/* Format selector */}
      <FormatSelector className="mb-6" />

      {/* Monotype Type Selector */}
      {isMonotype && hasTypeData && (
        <div className="mb-6 glass-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              🏷️ Monotype — Select Your Type
            </h3>
            {selectedMonoType && (
              <button
                onClick={() => setSelectedMonoType(null)}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                ✕ Show overall
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Select a type to get suggestions specific to that monotype team.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_TYPES.map(type => {
              const isSelected = selectedMonoType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedMonoType(isSelected ? null : type)}
                  className={`transition-all duration-200 rounded-lg cursor-pointer hover:scale-105
                    ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105' : ''}`}
                >
                  <TypeBadge type={type} size="md" />
                </button>
              );
            })}
          </div>
          {selectedMonoType && (
            <p className="text-xs text-slate-400 mt-3">
              Suggestions powered by <span className="text-white font-medium">{selectedMonoType}</span> monotype usage data.
            </p>
          )}
        </div>
      )}

      {chaosLoading && (
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading format data...
        </div>
      )}

      {!chaosLoading && !chaosData && (
        <div className="mb-4 glass-panel p-4 border border-amber-800/30 bg-amber-900/10">
          <p className="text-sm text-amber-400">
            ⚠️ No usage data available for <span className="font-medium text-white">{formatId}</span>.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            This format may not have enough ladder activity to generate stats. You can still build a team manually.
          </p>
        </div>
      )}

      {/* Team selector tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {teams.map((team, i) => (
          <button
            key={i}
            onClick={() => selectTeam(i)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${i === currentTeamIndex
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
          >
            {team.name}
            {teams.length > 1 && i === currentTeamIndex && (
              <button
                onClick={e => { e.stopPropagation(); deleteTeam(i); }}
                className="ml-1 text-white/50 hover:text-white/90"
                title="Delete team"
              >
                ×
              </button>
            )}
          </button>
        ))}
        <button
          onClick={() => addTeam()}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
        >
          + New
        </button>
      </div>

      {/* Team name editor */}
      <div className="mb-6">
        <input
          type="text"
          value={currentTeam.name}
          onChange={e => setTeamName(e.target.value)}
          className="input-field text-lg font-semibold !bg-transparent !border-transparent hover:!border-slate-700 focus:!border-blue-500 !px-2"
          placeholder="Team Name"
        />
      </div>

      {/* Synergy score badge */}
      {synergyScore !== null && (
        <div className="mb-6 flex items-center gap-3">
          <div className={`text-sm font-medium px-3 py-1 rounded-full ${
            synergyScore >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
            synergyScore >= 40 ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            Synergy: {synergyScore}%
          </div>
          <span className="text-xs text-slate-500">
            {teamMembers.length}/6 Pokémon
          </span>
        </div>
      )}

      {/* Team slots grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {currentTeam.pokemon.map((slot, index) => (
          <TeamSlotCard
            key={index}
            slot={slot}
            index={index}
            types={teamTypes[slot.species]}
            onEdit={() => setEditingSlot(index)}
            onClear={() => clearSlot(index)}
          />
        ))}
      </div>

      {/* Suggest Partners */}
      {teamMembers.length >= 1 && teamMembers.length < 6 && chaosData && (
        <SuggestPartnersPanel chaosData={chaosData} teamMembers={teamMembers} formatId={formatId} />
      )}

      {/* Type Analysis */}
      {showAnalysis && teamMembers.length >= 1 && (
        <TypeAnalysisPanel teamMembers={teamMembers} />
      )}

      {/* Pokemon Editor Modal */}
      {editingSlot !== null && (
        <PokemonEditorModal
          slot={currentTeam.pokemon[editingSlot]}
          slotIndex={editingSlot}
          chaosData={chaosData}
          format={format}
          formatId={formatId}
          onSave={(pokemon) => { setPokemon(editingSlot, pokemon); setEditingSlot(null); }}
          onClose={() => setEditingSlot(null)}
        />
      )}

      {/* Export Modal */}
      {showExport && (
        <ExportModal team={currentTeam} onClose={() => setShowExport(false)} />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onImport={(pokemon) => { importTeam(pokemon); setShowImport(false); }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

// ===================== Team Slot Card =====================
function TeamSlotCard({ slot, index, types, onEdit, onClear }) {
  const isEmpty = !slot.species;
  const spriteUrl = slot.species
    ? `https://play.pokemonshowdown.com/sprites/dex/${slot.species.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`
    : null;

  return (
    <div
      className={`glass-panel p-4 transition-all duration-200 group cursor-pointer
        ${isEmpty ? 'border-dashed border-slate-700/50 hover:border-slate-600' : 'card-hover'}`}
      onClick={onEdit}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-600">
          <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-sm">Slot {index + 1}</span>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <img
            src={spriteUrl}
            alt={slot.species}
            className="w-16 h-16 object-contain flex-shrink-0"
            onError={e => { e.target.style.opacity = '0.3'; }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm truncate">{slot.species}</h3>
              <button
                onClick={e => { e.stopPropagation(); onClear(); }}
                className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Clear slot"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <TypeBadgeRow types={types || []} size="xs" className="mt-1 mb-2" />
            <div className="text-xs text-slate-500 space-y-0.5">
              {slot.item && <p>@ {slot.item}</p>}
              {slot.ability && <p>{slot.ability}</p>}
              {slot.teraType && <p className="flex items-center gap-1">Tera: <TypeBadge type={slot.teraType} size="xs" /></p>}
            </div>
            <div className="mt-2 space-y-0.5">
              {slot.moves.filter(Boolean).map((move, i) => (
                <p key={i} className="text-xs text-slate-400">• {move}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== Pokemon Editor Modal (Stats-Driven) =====================
function PokemonEditorModal({ slot, slotIndex, chaosData, format, formatId, onSave, onClose }) {
  const [pokemon, setPokemonState] = useState({ ...createEmptyPokemon(), ...slot });
  const [activeTab, setActiveTab] = useState(slot.species ? 'moves' : 'pokemon');
  const [searchQuery, setSearchQuery] = useState('');
  const [pokemonChaos, setPokemonChaos] = useState(null);

  // Usage-sorted Pokemon list from chaos data
  const usageList = useMemo(() => {
    if (!chaosData) return [];
    return getUsageListFromChaos(chaosData);
  }, [chaosData]);

  // Filter by search
  const filteredPokemon = useMemo(() => {
    if (!searchQuery) return usageList.slice(0, 60);
    const q = searchQuery.toLowerCase();
    return usageList.filter(p => p.name.toLowerCase().includes(q)).slice(0, 60);
  }, [usageList, searchQuery]);

  // Load chaos data for selected pokemon
  useEffect(() => {
    if (pokemon.species && chaosData) {
      const data = getPokemonFromChaos(chaosData, pokemon.species);
      setPokemonChaos(data);
    } else {
      setPokemonChaos(null);
    }
  }, [pokemon.species, chaosData]);

  // Auto-set 0 Atk IVs when using a -Atk nature and no physical moves
  // (reduces Foul Play / confusion damage)
  const MINUS_ATK_NATURES = ['Bold', 'Calm', 'Modest', 'Timid'];
  useEffect(() => {
    if (!pokemon.species || !pokemon.nature) return;
    const isMinusAtk = MINUS_ATK_NATURES.includes(pokemon.nature);
    const filledMoves = pokemon.moves.filter(m => m);
    if (filledMoves.length === 0) return; // don't change until moves are set

    fetchMoves().then(allMoves => {
      const hasPhysical = filledMoves.some(moveName => {
        const id = moveName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const move = allMoves[id];
        return move && move.category === 'Physical';
      });

      setPokemonState(prev => {
        const shouldBeZero = isMinusAtk && !hasPhysical;
        const currentAtk = prev.ivs?.atk ?? 31;
        // Only update if the value actually needs to change
        if (shouldBeZero && currentAtk !== 0) {
          return { ...prev, ivs: { ...prev.ivs, atk: 0 } };
        } else if (!shouldBeZero && currentAtk === 0) {
          return { ...prev, ivs: { ...prev.ivs, atk: 31 } };
        }
        return prev;
      });
    });
  }, [pokemon.nature, pokemon.moves, pokemon.species]);

  // Compute sorted stats lists — use sum of values as denominator (handles weighted data correctly)
  const popularMoves = useMemo(() => {
    if (!pokemonChaos?.Moves) return [];
    const entries = sortByValue(pokemonChaos.Moves);
    const denom = (entries.reduce((s, [, v]) => s + v, 0) / 4) || 1; // 4 move slots
    return entries.map(([name, val]) => ({
      name: formatMoveName(name), pct: (val / denom) * 100,
    }));
  }, [pokemonChaos]);

  const popularAbilities = useMemo(() => {
    if (!pokemonChaos?.Abilities) return [];
    const entries = sortByValue(pokemonChaos.Abilities);
    const denom = entries.reduce((s, [, v]) => s + v, 0) || 1;
    return entries.map(([name, val]) => ({
      name: formatAbilityName(name), pct: (val / denom) * 100,
    }));
  }, [pokemonChaos]);

  const popularItems = useMemo(() => {
    if (!pokemonChaos?.Items) return [];
    const entries = sortByValue(pokemonChaos.Items);
    const denom = entries.reduce((s, [, v]) => s + v, 0) || 1;
    return entries.map(([name, val]) => ({
      name: formatItemName(name), pct: (val / denom) * 100,
    }));
  }, [pokemonChaos]);

  const popularTeraTypes = useMemo(() => {
    if (!pokemonChaos?.['Tera Types']) return [];
    const entries = sortByValue(pokemonChaos['Tera Types']);
    const denom = entries.reduce((s, [, v]) => s + v, 0) || 1;
    return entries.map(([name, val]) => ({
      name: formatTypeName(name), pct: (val / denom) * 100,
    }));
  }, [pokemonChaos]);

  const popularSpreads = useMemo(() => {
    if (!pokemonChaos?.Spreads) return [];
    const entries = sortByValue(pokemonChaos.Spreads);
    const denom = entries.reduce((s, [, v]) => s + v, 0) || 1;
    return entries.map(([name, val]) => ({
      spread: name,
      parsed: parseSpread(name),
      pct: (val / denom) * 100,
    }));
  }, [pokemonChaos]);

  const popularTeammates = useMemo(() => {
    if (!pokemonChaos?.Teammates) return [];
    const entries = sortByValue(pokemonChaos.Teammates);
    // Use Raw count as denominator — each value is how many times that teammate
    // appeared alongside this Pokemon, so dividing by raw count gives the true
    // "% of this Pokemon's teams that also had teammate X".
    const denom = pokemonChaos['Raw count'] || entries.reduce((s, [, v]) => s + v, 0) || 1;
    return entries.map(([name, val]) => ({
      name, pct: (val / denom) * 100,
    }));
  }, [pokemonChaos]);

  // Select a Pokemon — fills ability, item, spread, tera but NOT moves
  function selectPokemon(name) {
    const data = chaosData ? getPokemonFromChaos(chaosData, name) : null;
    setPokemonChaos(data);

    const newPoke = { ...createEmptyPokemon(), species: name };

    if (data) {
      const topAbility = formatAbilityName(sortByValue(data.Abilities || {})[0]?.[0] || '');
      const topItem = formatItemName(sortByValue(data.Items || {})[0]?.[0] || '');
      const topSpread = sortByValue(data.Spreads || {})[0]?.[0] || '';
      const spread = parseSpread(topSpread);
      const topTera = data['Tera Types'] ? formatTypeName(sortByValue(data['Tera Types'])[0]?.[0] || '') : '';

      newPoke.ability = topAbility;
      newPoke.item = topItem;
      newPoke.nature = spread?.nature || '';
      newPoke.evs = spread?.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      newPoke.teraType = topTera;
    }

    setPokemonState(newPoke);
    setSearchQuery('');
    setActiveTab('moves');
  }

  // Auto-fill the most popular full set (Shift+Enter shortcut)
  function autoFillTopSet() {
    if (!pokemon.species) return;
    const data = pokemonChaos || (chaosData ? getPokemonFromChaos(chaosData, pokemon.species) : null);
    if (!data) return;

    const topAbility = formatAbilityName(sortByValue(data.Abilities || {})[0]?.[0] || '');
    const topItem = formatItemName(sortByValue(data.Items || {})[0]?.[0] || '');
    const topMoves = sortByValue(data.Moves || {}).slice(0, 4).map(([n]) => formatMoveName(n));
    const topSpread = sortByValue(data.Spreads || {})[0]?.[0] || '';
    const spread = parseSpread(topSpread);
    const topTera = data['Tera Types'] ? formatTypeName(sortByValue(data['Tera Types'])[0]?.[0] || '') : '';

    setPokemonState(prev => ({
      ...prev,
      ability: topAbility,
      item: topItem,
      moves: [topMoves[0] || '', topMoves[1] || '', topMoves[2] || '', topMoves[3] || ''],
      nature: spread?.nature || prev.nature,
      evs: spread?.evs || prev.evs,
      teraType: topTera,
    }));
  }

  function applySpread(spreadData) {
    if (!spreadData?.parsed) return;
    setPokemonState(prev => ({
      ...prev,
      nature: spreadData.parsed.nature || prev.nature,
      evs: spreadData.parsed.evs || prev.evs,
    }));
  }

  const EDIT_TABS = [
    { id: 'pokemon', label: '🔍 Pokémon' },
    { id: 'moves', label: '⚔️ Moves' },
    { id: 'ability', label: '🧬 Ability' },
    { id: 'item', label: '🎒 Item' },
    ...(format.gen >= 9 ? [{ id: 'tera', label: '💎 Tera' }] : []),
    { id: 'spreads', label: '📊 Spreads' },
    { id: 'partners', label: '🤝 Partners' },
    { id: 'strategy', label: '📖 Strategy' },
  ];

  // Global keyboard handler for Shift+Enter
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        autoFillTopSet();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pokemon.species, pokemonChaos, chaosData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700/50 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {pokemon.species && (
              <img
                src={`https://play.pokemonshowdown.com/sprites/dex/${pokemon.species.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                alt={pokemon.species}
                className="w-10 h-10 object-contain"
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
            <div>
              <h2 className="font-bold text-white">
                {pokemon.species || `Slot ${slotIndex + 1}`}
              </h2>
              <p className="text-xs text-slate-500">{formatId} · {format.month}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={autoFillTopSet} className="btn-ghost text-xs text-slate-400 hover:text-white" title="Shift+Enter">
              ⚡ Popular Set
            </button>
            <button onClick={() => onSave(pokemon)} className="btn-primary text-sm">Save</button>
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-[73px] bg-slate-900/95 z-10 px-4 py-2 border-b border-slate-800">
          <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg overflow-x-auto">
            {EDIT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-2.5 py-1.5 text-xs font-medium rounded-md transition-all
                  ${activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {/* ========== POKEMON TAB ========== */}
          {activeTab === 'pokemon' && (
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field mb-3"
                placeholder="Search Pokémon by name..."
                autoFocus
              />
              {!chaosData && (
                <p className="text-sm text-amber-400 mb-3">
                  ⚠️ Stats data not available for this format. Try changing format settings.
                </p>
              )}
              <div className="text-xs text-slate-500 mb-2">
                Sorted by usage in {formatId} · {format.month}
                <span className="ml-2 text-slate-600">·</span>
                <span className="ml-2 text-blue-400/70">Shift+Enter = auto-fill top set</span>
              </div>
              <div className="space-y-0.5 max-h-[50vh] overflow-y-auto">
                {filteredPokemon.map((p, i) => (
                  <PokemonPickerRow
                    key={p.name}
                    pokemon={p}
                    rank={p.rank || i + 1}
                    isSelected={pokemon.species === p.name}
                    onClick={() => selectPokemon(p.name)}
                  />
                ))}
                {filteredPokemon.length === 0 && (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    No Pokémon found.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ========== MOVES TAB ========== */}
          {activeTab === 'moves' && (
            <div>
              {!pokemon.species ? (
                <EmptyState text="Select a Pokémon first to see suggested moves." />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Click a move to add it. Moves sorted by popularity in {formatId}.
                    </p>
                    <span className="text-xs text-blue-400/70">Shift+Enter = auto-fill top set</span>
                  </div>

                  {/* Current moves */}
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border
                        ${pokemon.moves[i]
                          ? 'bg-slate-800/60 border-slate-700'
                          : 'bg-slate-900/40 border-dashed border-slate-700/50'}`}
                      >
                        <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                        <span className={`text-sm flex-1 ${pokemon.moves[i] ? 'text-white' : 'text-slate-600'}`}>
                          {pokemon.moves[i] || 'Empty'}
                        </span>
                        {pokemon.moves[i] && (
                          <button
                            onClick={() => {
                              const moves = [...pokemon.moves];
                              moves[i] = '';
                              setPokemonState(prev => ({ ...prev, moves }));
                            }}
                            className="text-slate-600 hover:text-red-400 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Popular moves list */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">
                      Popular Moves ({popularMoves.length})
                    </h4>
                    <div className="space-y-0.5 max-h-[40vh] overflow-y-auto">
                      {popularMoves.map(move => {
                        const isSelected = pokemon.moves.includes(move.name);
                        return (
                          <button
                            key={move.name}
                            onClick={() => {
                              if (isSelected) return;
                              const moves = [...pokemon.moves];
                              const emptyIdx = moves.findIndex(m => !m);
                              if (emptyIdx !== -1) {
                                moves[emptyIdx] = move.name;
                                setPokemonState(prev => ({ ...prev, moves }));
                              }
                            }}
                            disabled={isSelected}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                              ${isSelected
                                ? 'bg-blue-900/30 border border-blue-700/30 text-blue-300'
                                : 'hover:bg-slate-800 text-slate-300 hover:text-white'}`}
                          >
                            <span className="flex-1 text-left">{move.name}</span>
                            <UsageBar pct={move.pct} color="blue" />
                            <span className="text-xs font-mono text-slate-500 w-16 text-right">
                              {move.pct.toFixed(1)}%
                            </span>
                            {isSelected && <span className="text-blue-400 text-xs">✓</span>}
                          </button>
                        );
                      })}
                      {popularMoves.length === 0 && (
                        <EmptyState text="No move data available for this Pokémon in this format." />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== ABILITY TAB ========== */}
          {activeTab === 'ability' && (
            <div>
              {!pokemon.species ? (
                <EmptyState text="Select a Pokémon first." />
              ) : (
                <div>
                  <p className="text-xs text-slate-500 mb-3">Select an ability for {pokemon.species}. Sorted by popularity.</p>
                  <BuildSection title="Ability" items={popularAbilities} selected={pokemon.ability}
                    onSelect={name => setPokemonState(p => ({ ...p, ability: name }))}
                    color="violet" maxShow={20}
                    fallback={
                      <input type="text" value={pokemon.ability}
                        onChange={e => setPokemonState(p => ({ ...p, ability: e.target.value }))}
                        className="input-field" placeholder="Ability name..." />
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* ========== ITEM TAB ========== */}
          {activeTab === 'item' && (
            <div>
              {!pokemon.species ? (
                <EmptyState text="Select a Pokémon first." />
              ) : (
                <div>
                  <p className="text-xs text-slate-500 mb-3">Select an item for {pokemon.species}. Sorted by popularity.</p>
                  <BuildSection title="Item" items={popularItems} selected={pokemon.item}
                    onSelect={name => setPokemonState(p => ({ ...p, item: name }))}
                    color="amber" maxShow={20}
                    fallback={
                      <input type="text" value={pokemon.item}
                        onChange={e => setPokemonState(p => ({ ...p, item: e.target.value }))}
                        className="input-field" placeholder="Item name..." />
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* ========== TERA TYPE TAB ========== */}
          {activeTab === 'tera' && format.gen >= 9 && (
            <div>
              {!pokemon.species ? (
                <EmptyState text="Select a Pokémon first." />
              ) : (
                <div>
                  <p className="text-xs text-slate-500 mb-3">Select a Tera Type for {pokemon.species}. Sorted by popularity.</p>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Tera Type</label>
                  <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
                    {popularTeraTypes.length > 0 ? (
                      popularTeraTypes.map(tera => (
                        <button key={tera.name}
                          onClick={() => setPokemonState(p => ({ ...p, teraType: tera.name }))}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                            ${pokemon.teraType === tera.name
                              ? 'bg-pink-900/30 border border-pink-700/30 text-pink-300'
                              : 'hover:bg-slate-800 text-slate-300 hover:text-white'}`}
                        >
                          <TypeBadge type={tera.name} size="xs" />
                          <span className="flex-1 text-left">{tera.name}</span>
                          <UsageBar pct={tera.pct} color="pink" />
                          <span className="text-xs font-mono text-slate-500 w-16 text-right">{tera.pct.toFixed(1)}%</span>
                          {pokemon.teraType === tera.name && <span className="text-pink-400 text-xs">✓</span>}
                        </button>
                      ))
                    ) : (
                      <select value={pokemon.teraType}
                        onChange={e => setPokemonState(p => ({ ...p, teraType: e.target.value }))}
                        className="select-field"
                      >
                        <option value="">Select Tera Type...</option>
                        {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== SPREADS TAB ========== */}
          {activeTab === 'spreads' && (
            <div>
              {!pokemon.species ? (
                <EmptyState text="Select a Pokémon first." />
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-3">Popular EV Spreads</label>
                  <div className="space-y-1">
                    {popularSpreads.length > 0 ? (
                      popularSpreads.slice(0, 15).map((s, i) => {
                        const isActive = pokemon.nature === s.parsed?.nature &&
                          JSON.stringify(pokemon.evs) === JSON.stringify(s.parsed?.evs);
                        return (
                          <button key={i} onClick={() => applySpread(s)}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors
                              ${isActive
                                ? 'bg-blue-900/30 border border-blue-700/30'
                                : i === 0 ? 'bg-slate-800/80 hover:bg-slate-700/80' : 'hover:bg-slate-800/60'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white font-semibold">{s.parsed?.nature || 'Unknown'} Nature</span>
                              <span className="text-sm text-slate-400">{s.pct.toFixed(1)}%</span>
                            </div>
                            {s.parsed?.evs && (
                              <div className="flex flex-wrap gap-x-4 text-xs text-slate-400 font-mono mt-1">
                                {Object.entries(s.parsed.evs).filter(([, v]) => v > 0).map(([stat, v]) => (
                                  <span key={stat}>{v} {stat.toUpperCase()}</span>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <EmptyState text="No spread data available for this Pokémon in this format." />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ========== PARTNERS TAB ========== */}
          {activeTab === 'partners' && (
            <div>
              {!pokemon.species ? (
                <EmptyState text="Select a Pokémon first." />
              ) : (
                <div>
                  <p className="text-xs text-slate-500 mb-3">
                    Most common teammates for {pokemon.species} in {formatId}.
                  </p>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                    Popular Partners ({popularTeammates.length})
                  </label>
                  <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
                    {popularTeammates.length > 0 ? (
                      popularTeammates.slice(0, 25).map((tm, i) => {
                        const sprite = `https://play.pokemonshowdown.com/sprites/dex/${tm.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
                        return (
                          <div key={tm.name}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
                          >
                            <span className="text-xs text-slate-600 w-5 text-right">{i + 1}</span>
                            <img src={sprite} alt="" className="w-8 h-8 object-contain flex-shrink-0"
                              onError={e => { e.target.style.display = 'none'; }} />
                            <span className="flex-1 text-white">{tm.name}</span>
                            <UsageBar pct={tm.pct} color="blue" />
                            <span className="text-xs font-mono text-slate-500 w-16 text-right">
                              {tm.pct.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <EmptyState text="No teammate data available for this Pokémon." />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ========== STRATEGY TAB ========== */}
          {activeTab === 'strategy' && (
            <StrategyTab
              pokemon={pokemon}
              format={format}
              formatId={formatId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== Strategy Tab =====================
function StrategyTab({ pokemon, format, formatId }) {
  if (!pokemon.species) {
    return <EmptyState text="Select a Pokémon first to see strategy info." />;
  }

  const smogonUrl = getSmogonDexUrl(pokemon.species, format.gen, formatId);
  const tierName = formatId.replace(/^gen\d+/, '');
  const tierLabel = TIERS.find(t => t.id === tierName)?.label || tierName.toUpperCase();

  return (
    <div className="space-y-4">
      {/* Smogon Dex Link */}
      <a
        href={smogonUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 glass-panel p-4 hover:bg-slate-800/60 transition-colors group"
      >
        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
            View {pokemon.species} on Smogon Dex
          </p>
          <p className="text-xs text-slate-500">
            Full {tierLabel} analysis, sets, and discussion
          </p>
        </div>
        <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

// ===================== Reusable Sub-Components =====================

function PokemonPickerRow({ pokemon, rank, isSelected, onClick }) {
  const [types, setTypes] = useState([]);

  useEffect(() => {
    getPokemonTypes(pokemon.name).then(setTypes).catch(() => {});
  }, [pokemon.name]);

  const spriteUrl = `https://play.pokemonshowdown.com/sprites/dex/${pokemon.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${isSelected
          ? 'bg-blue-900/30 border border-blue-700/30'
          : 'hover:bg-slate-800/60'}`}
    >
      <span className="text-xs text-slate-600 w-6 text-right font-mono">{rank}</span>
      <img src={spriteUrl} alt={pokemon.name}
        className="w-8 h-8 object-contain" loading="lazy"
        onError={e => { e.target.style.opacity = '0.2'; }} />
      <span className="text-white font-medium flex-1 text-left">{pokemon.name}</span>
      <TypeBadgeRow types={types} size="xs" />
      <span className="text-xs font-mono text-slate-500 w-16 text-right">
        {(pokemon.usage * 100).toFixed(1)}%
      </span>
    </button>
  );
}

function BuildSection({ title, items, selected, onSelect, color = 'blue', maxShow = 20, fallback }) {
  const colorMap = {
    blue: { active: 'bg-blue-900/30 border border-blue-700/30 text-blue-300', check: 'text-blue-400' },
    violet: { active: 'bg-violet-900/30 border border-violet-700/30 text-violet-300', check: 'text-violet-400' },
    amber: { active: 'bg-amber-900/30 border border-amber-700/30 text-amber-300', check: 'text-amber-400' },
    pink: { active: 'bg-pink-900/30 border border-pink-700/30 text-pink-300', check: 'text-pink-400' },
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">{title}</label>
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {items.length > 0 ? (
          items.slice(0, maxShow).map(item => (
            <button key={item.name} onClick={() => onSelect(item.name)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${selected === item.name ? colors.active : 'hover:bg-slate-800 text-slate-300 hover:text-white'}`}
            >
              <span className="flex-1 text-left">{item.name}</span>
              <UsageBar pct={item.pct} color={color} />
              <span className="text-xs font-mono text-slate-500 w-16 text-right">{item.pct.toFixed(1)}%</span>
              {selected === item.name && <span className={`${colors.check} text-xs`}>✓</span>}
            </button>
          ))
        ) : fallback}
      </div>
    </div>
  );
}

function UsageBar({ pct, color = 'blue' }) {
  const colorClass = {
    blue: 'bg-blue-500', violet: 'bg-violet-500', amber: 'bg-amber-500', pink: 'bg-pink-500',
  }[color] || 'bg-blue-500';

  return (
    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden flex-shrink-0">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="text-sm text-slate-500 py-8 text-center">{text}</p>;
}

// ===================== Export Modal =====================
function ExportModal({ team, onClose }) {
  const exportText = exportTeamToShowdown(team.pokemon);
  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass-panel w-full max-w-xl animate-slide-up">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="font-bold text-white">Export to Showdown</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <textarea readOnly value={exportText}
            className="input-field font-mono text-sm h-64 resize-none"
            onClick={e => e.target.select()} />
          <div className="mt-3 flex justify-end">
            <button onClick={copyToClipboard}
              className={`btn-primary text-sm ${copied ? '!bg-emerald-600' : ''}`}>
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== Import Modal =====================
function ImportModal({ onImport, onClose }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function handleImport() {
    try {
      const pokemon = importTeamFromShowdown(text);
      if (pokemon.length === 0) {
        setError('No valid Pokémon found. Please paste a Showdown team format.');
        return;
      }
      while (pokemon.length < 6) pokemon.push(createEmptyPokemon());
      onImport(pokemon.slice(0, 6));
    } catch (e) {
      setError('Failed to parse team. Please check the format.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass-panel w-full max-w-xl animate-slide-up">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="font-bold text-white">Import from Showdown</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <textarea value={text} onChange={e => { setText(e.target.value); setError(''); }}
            className="input-field font-mono text-sm h-64 resize-none"
            placeholder="Paste your Showdown team here..." />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button onClick={handleImport} className="btn-primary text-sm">Import Team</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== Suggest Partners Panel =====================
function SuggestPartnersPanel({ chaosData, teamMembers, formatId }) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    if (!chaosData || teamMembers.length === 0) return [];
    const onTeam = new Set(teamMembers.map(m => m.species));
    const scores = {};

    for (const member of teamMembers) {
      const data = getPokemonFromChaos(chaosData, member.species);
      if (!data?.Teammates) continue;
      for (const [name, val] of Object.entries(data.Teammates)) {
        if (onTeam.has(name)) continue;
        scores[name] = (scores[name] || 0) + val;
      }
    }

    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, score]) => ({ name, score }));
  }, [chaosData, teamMembers]);

  const maxScore = suggestions[0]?.score || 1;

  if (suggestions.length === 0) return null;

  return (
    <div className="glass-panel p-4 animate-fade-in">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold text-white hover:text-blue-400 transition-colors"
      >
        <span>🤝 Suggest Partners ({teamMembers.length}/6 slots filled)</span>
        <span className="text-xs text-slate-500">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-0.5 max-h-96 overflow-y-auto">
          <p className="text-xs text-slate-500 mb-2">
            Combined teammate synergy across your current team in {formatId}.
          </p>
          {suggestions.map((s, i) => {
            const sprite = `https://play.pokemonshowdown.com/sprites/dex/${s.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
            const barPct = (s.score / maxScore) * 100;
            return (
              <div key={s.name}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-slate-800/60 transition-colors"
              >
                <span className="text-xs text-slate-600 w-5 text-right">{i + 1}</span>
                <img src={sprite} alt="" className="w-8 h-8 object-contain flex-shrink-0"
                  onError={e => { e.target.style.display = 'none'; }} />
                <span className="flex-1 text-white">{s.name}</span>
                <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===================== Type Analysis Panel =====================
function TypeAnalysisPanel({ teamMembers }) {
  const matrix = generateTypeMatrix(teamMembers);
  const weaknesses = getTeamWeaknesses(teamMembers);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel p-5">
        <h3 className="font-semibold text-white mb-4 text-sm">Team Weakness Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {weaknesses.map(({ type, weakCount, resistCount, score }) => (
            <div key={type}
              className={`rounded-lg p-2 text-center text-xs ${
                score > 1 ? 'bg-red-900/40 border border-red-700/30' :
                score > 0 ? 'bg-amber-900/30 border border-amber-700/20' :
                score < -1 ? 'bg-emerald-900/40 border border-emerald-700/30' :
                score < 0 ? 'bg-emerald-900/20 border border-emerald-800/20' :
                'bg-slate-800/50 border border-slate-700/20'
              }`}
            >
              <TypeBadge type={type} size="xs" />
              <div className="mt-1 font-mono">
                <span className="text-red-400">{weakCount}</span>
                <span className="text-slate-600 mx-0.5">/</span>
                <span className="text-emerald-400">{resistCount}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          <span className="text-red-400">Red</span> = weak count ·{' '}
          <span className="text-emerald-400">Green</span> = resist/immune count
        </p>
      </div>

      <div className="glass-panel p-5 overflow-x-auto">
        <h3 className="font-semibold text-white mb-4 text-sm">Defensive Type Chart</h3>
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-500 p-1 w-16">Attack</th>
              {teamMembers.map((m, i) => (
                <th key={i} className="text-center text-slate-300 p-1 truncate max-w-[80px]" title={m.species}>
                  {m.species.slice(0, 8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => (
              <tr key={row.attackType}>
                <td className="p-1"><TypeBadge type={row.attackType} size="xs" /></td>
                {row.matchups.map((m, i) => (
                  <td key={i} className="p-1 text-center">
                    <span className={`inline-block w-8 py-0.5 rounded text-[10px] font-bold ${getEffectivenessClass(m.multiplier)}`}>
                      {getEffectivenessLabel(m.multiplier)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
