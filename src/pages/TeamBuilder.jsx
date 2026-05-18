import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTeam } from '../context/TeamContext';
import { useApp } from '../context/AppContext';
import { exportTeamToShowdown, importTeamFromShowdown, createEmptyPokemon, createEmptyTeam } from '../utils/exportShowdown';
import { fetchChaosData, getPokemonFromChaos, getUsageListFromChaos, fetchMonotypeChaosData } from '../services/smogonApi';
import { fetchPokedex, getPokemonTypes, formatMoveName, formatItemName, formatAbilityName, formatTypeName, fetchMoves } from '../services/showdownData';
import { TypeBadgeRow } from '../components/TypeBadge';
import TypeBadge from '../components/TypeBadge';
import FormatSelector from '../components/FormatSelector';
import { ALL_TYPES, isMonotypeFormat, hasMonotypeTypeData, getMonotypeFormatId, getSmogonDexUrl, TIERS } from '../data/formats';
import { generateTypeMatrix, calculateSynergyScore, getTeamWeaknesses } from '../utils/typeAnalysis';
import { getEffectivenessClass, getEffectivenessLabel, sortByValue, parseSpread } from '../utils/helpers';
import { getSuggestions, getTeamCohesion } from '../utils/teamSynergy';
import { getFormatItemList, getItemUsers } from '../utils/itemSearch';

export default function TeamBuilder() {
  const {
    teams, currentTeamIndex, currentTeam,
    setPokemon, clearSlot, setTeamName, addTeam, deleteTeam, copyTeam, selectTeam, importTeam, setTeamFormat
  } = useTeam();
  const { format, formatId, setFormat } = useApp();
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

  // Keep team's stored format in sync with the current format
  useEffect(() => {
    if (formatId && currentTeam.formatId !== formatId) {
      setTeamFormat(formatId, { gen: format.gen, tier: format.tier, month: format.month, rating: format.rating });
    }
  }, [formatId, format.gen, format.tier, format.month, format.rating]);

  // When switching teams, restore the team's stored format into AppContext
  useEffect(() => {
    if (currentTeam.format) {
      const tf = currentTeam.format;
      // Only dispatch if the format actually differs to avoid loops
      if (tf.gen !== format.gen || tf.tier !== format.tier || tf.month !== format.month || tf.rating !== format.rating) {
        setFormat(tf);
      }
    }
  }, [currentTeamIndex]);

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
            <div className="flex flex-col items-start">
              <span>{team.name}</span>
              {team.formatId && (
                <span className={`text-[10px] font-normal leading-tight ${
                  i === currentTeamIndex ? 'text-blue-200' : 'text-slate-500'
                }`}>
                  {team.formatId}
                </span>
              )}
            </div>
            {i === currentTeamIndex && (
              <span className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={e => { e.stopPropagation(); copyTeam(); }}
                  className="text-white/40 hover:text-white/90 px-0.5"
                  title="Duplicate team"
                >
                  ⧉
                </button>
                {teams.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteTeam(i); }}
                    className="text-white/40 hover:text-white/90 px-0.5"
                    title="Delete team"
                  >
                    ×
                  </button>
                )}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => addTeam(undefined, formatId, { gen: format.gen, tier: format.tier, month: format.month, rating: format.rating })}
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

      {/* Suggest Next */}
      {teamMembers.length >= 1 && teamMembers.length < 6 && chaosData && (
        <SuggestPartnersPanel chaosData={chaosData} teamMembers={teamMembers} formatId={formatId} />
      )}

      {/* Team Cohesion */}
      {teamMembers.length >= 2 && chaosData && (
        <TeamCohesionPanel chaosData={chaosData} teamMembers={teamMembers} formatId={formatId} />
      )}

      {/* Item Lookup */}
      {chaosData && (
        <ItemSearchPanel chaosData={chaosData} formatId={formatId} />
      )}

      {/* Type Analysis & Role Checklist */}
      {showAnalysis && teamMembers.length >= 1 && (
        <div className="space-y-6">
          <TeamChecklistPanel
            pokemon={currentTeam.pokemon}
            teamMembers={teamMembers}
            teamTypes={teamTypes}
            chaosData={chaosData}
          />
          <TypeAnalysisPanel teamMembers={teamMembers} />
        </div>
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
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  const [pokemonChaos, setPokemonChaos] = useState(null);
  const [pokemonTypeMap, setPokemonTypeMap] = useState({});

  // Usage-sorted Pokemon list from chaos data
  const usageList = useMemo(() => {
    if (!chaosData) return [];
    return getUsageListFromChaos(chaosData);
  }, [chaosData]);

  useEffect(() => {
    let cancelled = false;

    if (usageList.length === 0) {
      setPokemonTypeMap({});
      return () => { cancelled = true; };
    }

    fetchPokedex()
      .then(pokedex => {
        if (cancelled) return;

        const lookup = new Map();
        Object.entries(pokedex).forEach(([id, data]) => {
          if (!data?.name) return;
          lookup.set(id, data);
          lookup.set(data.name.toLowerCase(), data);
        });

        const nextTypeMap = {};
        usageList.forEach(entry => {
          const normalizedId = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const data = lookup.get(normalizedId) || lookup.get(entry.name.toLowerCase());
          if (data?.types?.length) {
            nextTypeMap[entry.name] = data.types;
          }
        });

        setPokemonTypeMap(nextTypeMap);
      })
      .catch(() => {
        if (!cancelled) setPokemonTypeMap({});
      });

    return () => { cancelled = true; };
  }, [usageList]);

  // Filter by search (no hard cap — progressive loading handles display)
  const filteredPokemon = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return usageList.filter(entry => {
      const types = pokemonTypeMap[entry.name] || [];
      const matchesQuery = !q
        || entry.name.toLowerCase().includes(q)
        || types.some(type => type.toLowerCase().includes(q));
      const matchesType = !selectedTypeFilter || types.includes(selectedTypeFilter);
      return matchesQuery && matchesType;
    });
  }, [usageList, searchQuery, selectedTypeFilter, pokemonTypeMap]);

  // Progressive loading: start with 60, load more on scroll
  const [visibleCount, setVisibleCount] = useState(60);
  const listRef = useRef(null);

  // Reset visible count when search or data changes
  useEffect(() => {
    setVisibleCount(60);
  }, [searchQuery, selectedTypeFilter, chaosData]);

  const handleListScroll = useCallback((e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setVisibleCount(prev => Math.min(prev + 40, filteredPokemon.length));
    }
  }, [filteredPokemon.length]);

  const displayedPokemon = filteredPokemon.slice(0, visibleCount);

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
  // Auto-set 0 Spe IVs when using a -Spe nature and 0 Spe EVs
  // (for Trick Room teams or slow pivots that want to move last)
  const MINUS_SPE_NATURES = ['Brave', 'Quiet', 'Relaxed', 'Sassy'];
  useEffect(() => {
    if (!pokemon.species || !pokemon.nature) return;
    const isMinusAtk = MINUS_ATK_NATURES.includes(pokemon.nature);
    const isMinusSpe = MINUS_SPE_NATURES.includes(pokemon.nature);
    const filledMoves = pokemon.moves.filter(m => m);
    if (filledMoves.length === 0) return; // don't change until moves are set

    fetchMoves().then(allMoves => {
      const hasPhysical = filledMoves.some(moveName => {
        const id = moveName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const move = allMoves[id];
        return move && move.category === 'Physical';
      });

      setPokemonState(prev => {
        let newIvs = { ...prev.ivs };
        let changed = false;

        // 0 Atk IVs: -Atk nature + no physical moves
        const shouldAtkBeZero = isMinusAtk && !hasPhysical;
        const currentAtk = newIvs.atk ?? 31;
        if (shouldAtkBeZero && currentAtk !== 0) {
          newIvs.atk = 0;
          changed = true;
        } else if (!shouldAtkBeZero && currentAtk === 0) {
          newIvs.atk = 31;
          changed = true;
        }

        // 0 Spe IVs: -Spe nature + 0 Spe EVs
        const hasSpeEvs = (prev.evs?.spe ?? 0) > 0;
        const shouldSpeBeZero = isMinusSpe && !hasSpeEvs;
        const currentSpe = newIvs.spe ?? 31;
        if (shouldSpeBeZero && currentSpe !== 0) {
          newIvs.spe = 0;
          changed = true;
        } else if (!shouldSpeBeZero && currentSpe === 0) {
          newIvs.spe = 31;
          changed = true;
        }

        return changed ? { ...prev, ivs: newIvs } : prev;
      });
    });
  }, [pokemon.nature, pokemon.moves, pokemon.species, pokemon.evs?.spe]);

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
    // Teammate values in chaos data are differentials (weighted co-occurrence minus expected).
    // The correct denominator is the Pokemon's weighted count = sum of Ability values.
    const abilityEntries = Object.values(pokemonChaos.Abilities || {});
    const weightedCount = abilityEntries.reduce((s, v) => s + v, 0) || 1;
    return entries.map(([name, val]) => ({
      name, pct: (val / weightedCount) * 100,
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
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field"
                  placeholder="Search Pokemon by name or type..."
                  autoFocus
                />
                <select
                  value={selectedTypeFilter}
                  onChange={e => setSelectedTypeFilter(e.target.value)}
                  className="select-field"
                >
                  <option value="">All types</option>
                  {ALL_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              {!chaosData && (
                <p className="text-sm text-amber-400 mb-3">
                  ⚠️ Stats data not available for this format. Try changing format settings.
                </p>
              )}
              <div className="text-xs text-slate-500 mb-2">
                Sorted by usage in {formatId} · {format.month}
                <span className="ml-2 text-slate-600">·</span>
                <span className="ml-2">
                  {selectedTypeFilter ? `Filtered to ${selectedTypeFilter}-types` : 'All types'}
                </span>
                <span className="ml-2 text-slate-600">·</span>
                <span className="ml-2 text-blue-400/70">Shift+Enter = auto-fill top set</span>
              </div>
              <div ref={listRef} onScroll={handleListScroll} className="space-y-0.5 max-h-[50vh] overflow-y-auto">
                {displayedPokemon.map((p, i) => (
                  <PokemonPickerRow
                    key={p.name}
                    pokemon={p}
                    types={pokemonTypeMap[p.name] || []}
                    rank={p.rank || i + 1}
                    isSelected={pokemon.species === p.name}
                    onClick={() => selectPokemon(p.name)}
                  />
                ))}
                {visibleCount < filteredPokemon.length && (
                  <p className="text-xs text-slate-500 py-2 text-center">
                    Showing {visibleCount} of {filteredPokemon.length} · scroll for more
                  </p>
                )}
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

function PokemonPickerRow({ pokemon, types, rank, isSelected, onClick }) {
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

  function createPokepaste() {
    if (!exportText.trim()) return;

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://pokepast.es/create';
    form.target = '_blank';

    const fields = {
      paste: exportText,
      title: team?.name || 'Exported Team',
      author: '',
      notes: '',
    };

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass-panel w-full max-w-xl animate-slide-up">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="font-bold text-white">Export Team</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 mb-2">Showdown export text (also used for Pokepaste)</p>
          <textarea readOnly value={exportText}
            className="input-field font-mono text-sm h-64 resize-none"
            onClick={e => e.target.select()} />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={createPokepaste}
              disabled={!exportText.trim()}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              Create Pokepaste
            </button>
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

// ===================== Suggest Next Panel =====================
const SUGGESTION_MODES = [
  {
    id: 'balanced',
    label: '🎯 Balanced',
    description: 'Normalised synergy — strong pairings at any usage level. Niche low-usage picks no longer drown out real format threats.',
  },
  {
    id: 'spicy',
    label: '🌶️ Spicy',
    description: 'Amplifies rare high-synergy picks. Lower-usage Pokémon with strong teammate lift float to the top.',
  },
  {
    id: 'safe',
    label: '🛡️ Safe',
    description: 'Synergy-aware but weighted toward popular, reliable options with proven format presence.',
  },
];

const CONFIDENCE_STYLE = {
  high:   'bg-emerald-900/40 text-emerald-400',
  medium: 'bg-amber-900/40 text-amber-400',
  low:    'bg-slate-700/60 text-slate-400',
  none:   'bg-slate-700/60 text-slate-500',
};

function SuggestPartnersPanel({ chaosData, teamMembers, formatId }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('balanced');
  const [expandedRow, setExpandedRow] = useState(null);

  const suggestions = useMemo(
    () => getSuggestions(teamMembers, chaosData, { mode, count: 15 }),
    [chaosData, teamMembers, mode],
  );

  const maxScore = suggestions[0]?.score || 1;

  if (suggestions.length === 0 && !open) return null;

  const modeInfo = SUGGESTION_MODES.find(m => m.id === mode);

  return (
    <div className="glass-panel p-4 animate-fade-in mb-4">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold text-white hover:text-blue-400 transition-colors"
      >
        <span>🤝 Suggest Next <span className="font-normal text-slate-400">({teamMembers.length}/6 slots filled)</span></span>
        <span className="text-xs text-slate-500">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="mt-3">
          {/* Mode toggle */}
          <div className="flex gap-1.5 mb-2">
            {SUGGESTION_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setExpandedRow(null); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                  ${ mode === m.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500 mb-3">{modeInfo.description}</p>

          {suggestions.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No suggestions available for this team.</p>
          ) : (
            <div className="space-y-px max-h-[32rem] overflow-y-auto">
              {suggestions.map((s, i) => {
                const spriteId = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const barPct = (s.score / maxScore) * 100;
                const isExpanded = expandedRow === s.name;

                // pairing pills: show up to 3 inline, rest in expand
                const pills = s.liftDetails.slice(0, 3);

                return (
                  <div key={s.name} className="rounded-lg overflow-hidden">
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : s.name)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-800/60 transition-colors text-left"
                    >
                      <span className="text-xs text-slate-600 w-5 text-right shrink-0">{i + 1}</span>
                      <img
                        src={`https://play.pokemonshowdown.com/sprites/dex/${spriteId}.png`}
                        alt=""
                        className="w-8 h-8 object-contain shrink-0"
                        onError={e => { e.target.style.opacity = '0.2'; }}
                      />
                      <span className="text-white font-medium w-36 shrink-0 truncate">{s.name}</span>

                      {/* Per-member pairing pills */}
                      {s.method === 'lift' ? (
                        <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                          {pills.map(l => {
                            const memberSpriteId = l.member.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const color = l.lift >= 2
                              ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700/40'
                              : l.lift >= 1
                              ? 'bg-blue-900/40 text-blue-300 border-blue-700/30'
                              : 'bg-slate-700/50 text-slate-400 border-slate-600/30';
                            return (
                              <span
                                key={l.member}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium shrink-0 ${color}`}
                                title={`Appears on ${l.pConditionalPct.toFixed(1)}% of ${l.member} teams (base: ${s.baseUsagePct.toFixed(1)}%)`}
                              >
                                <img
                                  src={`https://play.pokemonshowdown.com/sprites/dex/${memberSpriteId}.png`}
                                  alt=""
                                  className="w-4 h-4 object-contain"
                                  onError={e => { e.target.style.display = 'none'; }}
                                />
                                {l.pConditionalPct.toFixed(1)}%
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="flex-1 text-xs text-slate-500 italic">no pairing data</span>
                      )}

                      {/* Base usage as baseline reference */}
                      <span className="text-[11px] text-slate-500 shrink-0 ml-1" title="Overall format usage">
                        base {s.baseUsagePct.toFixed(1)}%
                      </span>
                      <span className="text-slate-600 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {/* Expandable details */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 bg-slate-800/30 text-xs">
                        {s.method === 'fallback' ? (
                          <p className="text-slate-500 italic py-1">No teammate co-occurrence data — ranked by base usage only.</p>
                        ) : (
                          <>
                            <div className="text-slate-500 uppercase tracking-wide mb-1.5">Pairing breakdown</div>
                            <table className="w-full">
                              <thead>
                                <tr className="text-slate-600 text-[10px] uppercase">
                                  <th className="text-left pb-1 font-medium">Team member</th>
                                  <th className="text-right pb-1 font-medium">% paired</th>
                                  <th className="text-right pb-1 font-medium">Base usage</th>
                                  <th className="text-right pb-1 font-medium">Lift</th>
                                  <th className="text-right pb-1 font-medium">Co-occ.</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700/30">
                                {s.liftDetails.map(l => (
                                  <tr key={l.member}>
                                    <td className="py-1 text-slate-300 truncate max-w-[120px]">{l.member}</td>
                                    <td className="py-1 text-right font-mono"
                                      style={{ color: l.lift >= 2 ? '#34d399' : l.lift >= 1 ? '#93c5fd' : '#f87171' }}
                                    >
                                      {l.pConditionalPct.toFixed(1)}%
                                    </td>
                                    <td className="py-1 text-right font-mono text-slate-500">{s.baseUsagePct.toFixed(1)}%</td>
                                    <td className="py-1 text-right font-mono text-slate-400">{l.lift.toFixed(2)}×</td>
                                    <td className="py-1 text-right font-mono text-slate-500">
                                      {l.hasData
                                        ? '~' + Math.round(l.rawCoOccurrence).toLocaleString()
                                        : <span className="text-slate-600">—</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p className="text-slate-600 mt-1.5">Co-occ. = weighted battle count seen together. % paired = fraction of {s.liftDetails[0]?.member ?? 'team member'} teams this Pokémon also appears on.</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== Team Cohesion Panel =====================
function TeamCohesionPanel({ chaosData, teamMembers, formatId }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const { pairs, members } = useMemo(
    () => getTeamCohesion(teamMembers, chaosData),
    [chaosData, teamMembers],
  );

  if (members.length === 0) return null;

  // Overall team cohesion = average of all pair avgPct values
  const teamAvgPct = pairs.length
    ? pairs.reduce((s, p) => s + p.avgPct, 0) / pairs.length
    : 0;

  const cohesionColor =
    teamAvgPct >= 15 ? 'text-emerald-400' :
    teamAvgPct >= 7  ? 'text-amber-400' :
    'text-red-400';

  return (
    <div className="glass-panel p-4 animate-fade-in mb-4">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold text-white hover:text-blue-400 transition-colors"
      >
        <span>
          🔗 Team Cohesion
          <span className="font-normal text-slate-400 ml-1">({teamMembers.length} members)</span>
          {!open && (
            <span className={`ml-2 text-xs font-medium ${cohesionColor}`}>
              {teamAvgPct.toFixed(1)}% avg pairing
            </span>
          )}
        </span>
        <span className="text-xs text-slate-500">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-3">
            How often each of your Pokémon appears alongside the others in {formatId} teams.
            Sorted weakest-first — the odd one out shows at the top.
          </p>

          {/* Per-member rows */}
          <div className="space-y-px mb-4">
            {members.map((m, i) => {
              const spriteId = m.species.toLowerCase().replace(/[^a-z0-9]/g, '');
              const isExpanded = expanded === m.species;
              const barColor =
                m.avgPairPct >= 15 ? 'bg-emerald-500' :
                m.avgPairPct >= 7  ? 'bg-amber-500' :
                'bg-red-500';
              const textColor =
                m.avgPairPct >= 15 ? 'text-emerald-400' :
                m.avgPairPct >= 7  ? 'text-amber-400' :
                'text-red-400';
              // rank badge: 1 = weakest link
              const rankLabel = i === 0 ? '⚠️ weakest' : i === members.length - 1 ? '✅ strongest' : null;

              return (
                <div key={m.species} className="rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : m.species)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <img
                      src={`https://play.pokemonshowdown.com/sprites/dex/${spriteId}.png`}
                      alt=""
                      className="w-8 h-8 object-contain shrink-0"
                      onError={e => { e.target.style.opacity = '0.2'; }}
                    />
                    <span className="text-white font-medium w-36 shrink-0 truncate">{m.species}</span>
                    {rankLabel && (
                      <span className="text-[10px] text-slate-500 shrink-0">{rankLabel}</span>
                    )}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(m.avgPairPct * 3, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono shrink-0 ${textColor}`}>
                        {m.avgPairPct.toFixed(1)}% avg
                      </span>
                    </div>
                    {!m.inChaos && (
                      <span className="text-[10px] text-slate-600 shrink-0">no data</span>
                    )}
                    <span className="text-slate-600 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Expandable: pairings with each teammate */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-slate-800/30 text-xs">
                      <div className="text-slate-500 uppercase tracking-wide mb-1.5">Pairing with teammates</div>
                      <table className="w-full">
                        <thead>
                          <tr className="text-[10px] text-slate-600 uppercase">
                            <th className="text-left pb-1 font-medium">Teammate</th>
                            <th className="text-right pb-1 font-medium">% on {m.species} teams</th>
                            <th className="text-right pb-1 font-medium">% on their teams</th>
                            <th className="text-right pb-1 font-medium">Avg</th>
                            <th className="text-right pb-1 font-medium">Lift</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {m.pairsData
                            .map(p => ({
                              ...p,
                              teammate: p.a === m.species ? p.b : p.a,
                              pFromMe:  p.a === m.species ? p.pAtoB : p.pBtoA,
                              pFromThem:p.a === m.species ? p.pBtoA : p.pAtoB,
                            }))
                            .sort((a, b) => b.avgPct - a.avgPct)
                            .map(p => {
                              const tmSpriteId = p.teammate.toLowerCase().replace(/[^a-z0-9]/g, '');
                              const liftColor = p.lift >= 2 ? '#34d399' : p.lift >= 1 ? '#93c5fd' : '#f87171';
                              return (
                                <tr key={p.teammate}>
                                  <td className="py-1">
                                    <span className="inline-flex items-center gap-1">
                                      <img
                                        src={`https://play.pokemonshowdown.com/sprites/dex/${tmSpriteId}.png`}
                                        alt=""
                                        className="w-4 h-4 object-contain"
                                        onError={e => { e.target.style.display = 'none'; }}
                                      />
                                      <span className="text-slate-300">{p.teammate}</span>
                                    </span>
                                  </td>
                                  <td className="py-1 text-right font-mono text-slate-300">{p.pFromMe.toFixed(1)}%</td>
                                  <td className="py-1 text-right font-mono text-slate-400">{p.pFromThem.toFixed(1)}%</td>
                                  <td className="py-1 text-right font-mono" style={{ color: liftColor }}>{p.avgPct.toFixed(1)}%</td>
                                  <td className="py-1 text-right font-mono text-slate-400">{p.lift.toFixed(2)}×</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                      {!m.inChaos && (
                        <p className="text-slate-600 italic mt-1">No chaos data for {m.species} in this format.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pairwise matrix summary */}
          {pairs.length >= 3 && (
            <>
              <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-1.5">All pairs · avg pairing %</div>
              <div className="grid gap-px"
                style={{ gridTemplateColumns: `repeat(${teamMembers.length}, minmax(0,1fr))` }}
              >
                {/* Column headers */}
                {teamMembers.map(m => (
                  <div key={m.species} className="text-[9px] text-slate-600 text-center truncate px-0.5 pb-1">
                    {m.species.slice(0, 6)}
                  </div>
                ))}
                {/* Matrix cells */}
                {teamMembers.map(rowM => (
                  teamMembers.map(colM => {
                    if (rowM.species === colM.species) {
                      return (
                        <div key={colM.species}
                          className="aspect-square rounded bg-slate-800/60 flex items-center justify-center text-[9px] text-slate-600"
                        >—</div>
                      );
                    }
                    const pair = pairs.find(
                      p => (p.a === rowM.species && p.b === colM.species) ||
                           (p.b === rowM.species && p.a === colM.species)
                    );
                    const pct = pair?.avgPct ?? 0;
                    const bg =
                      pct >= 20 ? 'bg-emerald-700/60 text-emerald-300' :
                      pct >= 10 ? 'bg-emerald-900/50 text-emerald-400' :
                      pct >= 5  ? 'bg-slate-700/60 text-slate-300' :
                      'bg-slate-800/40 text-slate-500';
                    return (
                      <div key={colM.species}
                        className={`aspect-square rounded flex items-center justify-center text-[9px] font-mono ${bg}`}
                        title={`${rowM.species} ↔ ${colM.species}: ${pct.toFixed(1)}%`}
                      >
                        {pct.toFixed(0)}%
                      </div>
                    );
                  })
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-1">Each cell = avg % these two Pokémon appear on the same team in {formatId}.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== Item Search Panel =====================
function ItemSearchPanel({ chaosData, formatId }) {
  const [open, setOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [threshold, setThreshold] = useState(10);

  const formatItems = useMemo(() => getFormatItemList(chaosData), [chaosData]);

  // Filter visible item list by search text
  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    const items = q
      ? formatItems.filter(id => formatItemName(id).toLowerCase().includes(q))
      : formatItems;
    return items.slice(0, 80);
  }, [formatItems, itemQuery]);

  const results = useMemo(() => {
    if (!selectedItemId) return [];
    return getItemUsers(chaosData, selectedItemId, threshold / 100);
  }, [chaosData, selectedItemId, threshold]);

  // When chaosData changes (format switch), reset selection
  useEffect(() => {
    setSelectedItemId('');
    setItemQuery('');
  }, [chaosData]);

  return (
    <div className="glass-panel p-4 animate-fade-in mb-4">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold text-white hover:text-blue-400 transition-colors"
      >
        <span>🎒 Find by Item</span>
        <span className="text-xs text-slate-500">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-3">
            Search for Pokémon that commonly run a specific item in <span className="text-white">{formatId}</span>.
          </p>

          {/* Item search input */}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={itemQuery}
              onChange={e => setItemQuery(e.target.value)}
              placeholder="Search items..."
              className="input-field flex-1"
            />
            {selectedItemId && (
              <button
                onClick={() => { setSelectedItemId(''); setItemQuery(''); }}
                className="btn-ghost text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Item list */}
          {!selectedItemId && (
            <div className="max-h-48 overflow-y-auto mb-3 space-y-px">
              {filteredItems.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No items found.</p>
              ) : (
                filteredItems.map(id => (
                  <button
                    key={id}
                    onClick={() => { setSelectedItemId(id); setItemQuery(formatItemName(id)); }}
                    className="w-full text-left px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
                  >
                    {formatItemName(id)}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Threshold slider — shown after an item is selected */}
          {selectedItemId && (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">
                  Showing Pokémon that run <span className="text-white font-medium">{formatItemName(selectedItemId)}</span>
                  {' '}≥ {threshold}% of the time
                </span>
                <span className="text-xs font-mono text-slate-500">{threshold}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={75}
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-full h-1.5 accent-blue-500 mb-3"
              />

              {/* Results */}
              {results.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No Pokémon run {formatItemName(selectedItemId)} ≥ {threshold}% in {formatId}.
                </p>
              ) : (
                <div className="space-y-px max-h-80 overflow-y-auto">
                  <div className="flex text-[10px] text-slate-600 uppercase tracking-wide px-3 mb-1 gap-2">
                    <span className="w-5" />
                    <span className="w-8" />
                    <span className="flex-1">Pokémon</span>
                    <span className="w-32 text-right">Item usage</span>
                    <span className="w-20 text-right">Format %</span>
                  </div>
                  {results.map((r, i) => {
                    const spriteId = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return (
                      <div
                        key={r.name}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-800/60 transition-colors"
                      >
                        <span className="text-xs text-slate-600 w-5 text-right shrink-0">{i + 1}</span>
                        <img
                          src={`https://play.pokemonshowdown.com/sprites/dex/${spriteId}.png`}
                          alt=""
                          className="w-8 h-8 object-contain shrink-0"
                          onError={e => { e.target.style.opacity = '0.2'; }}
                        />
                        <span className="flex-1 text-white font-medium">{r.name}</span>
                        <div className="w-32 flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(r.itemPct, 100)}%` }} />
                          </div>
                          <span className="text-xs font-mono text-slate-400 w-12 text-right">{r.itemPct.toFixed(1)}%</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 w-20 text-right">{(r.usage * 100).toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== Team Role Checklist =====================
function TeamChecklistPanel({ pokemon, teamMembers, teamTypes, chaosData }) {
  const [moveData, setMoveData] = useState(null);
  const [pokedex, setPokedex] = useState(null);

  useEffect(() => {
    fetchMoves().then(setMoveData).catch(() => {});
    fetchPokedex().then(setPokedex).catch(() => {});
  }, []);

  const checks = useMemo(() => {
    if (!moveData || teamMembers.length === 0) return [];

    const filledSlots = pokemon.filter(p => p.species);
    const getMoveId = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const getMove = (name) => moveData[getMoveId(name)] || null;
    const getTypes = (species) => teamTypes[species] || [];
    const results = [];

    // 1. Priority (reliable vs conditional)
    const RELIABLE_PRIORITY_IDS = new Set([
      'extremespeed', 'aquajet', 'bulletpunch', 'iceshard',
      'machpunch', 'shadowsneak', 'accelerock',
      'grassyglide', 'jetpunch', 'quickattack',
      'firstimpression', 'watershuriken'
    ]);
    const CONDITIONAL_PRIORITY_IDS = new Set([
      'suckerpunch', 'thunderclap', 'fakeout'
    ]);
    const reliablePriorityUsers = filledSlots.filter(p =>
      p.moves.some(m => m && RELIABLE_PRIORITY_IDS.has(getMoveId(m)))
    );
    const conditionalPriorityUsers = filledSlots.filter(p =>
      !p.moves.some(m => m && RELIABLE_PRIORITY_IDS.has(getMoveId(m))) &&
      p.moves.some(m => m && CONDITIONAL_PRIORITY_IDS.has(getMoveId(m)))
    );
    const allPriorityUsers = [...reliablePriorityUsers, ...conditionalPriorityUsers];
    const priorityStatus = reliablePriorityUsers.length > 0 ? 'pass'
      : conditionalPriorityUsers.length > 0 ? 'warn' : 'fail';
    results.push({
      name: 'Priority', icon: '⚡',
      status: priorityStatus,
      providers: allPriorityUsers.map(p => p.species),
      detail: priorityStatus === 'pass' ? null
        : priorityStatus === 'warn' ? 'Only conditional priority (Sucker Punch, Thunderclap, Fake Out) — can be played around'
        : 'No priority moves on the team',
    });

    // 2. Fast Pokemon (Scarf or speed-boosting ability only)
    const SPEED_ABILITIES = new Set([
      'speed boost', 'swift swim', 'chlorophyll', 'sand rush',
      'slush rush', 'unburden', 'protosynthesis', 'quark drive'
    ]);
    const fastUsers = filledSlots.filter(p => {
      const hasScarf = p.item && p.item.toLowerCase() === 'choice scarf';
      const hasSpeedAbility = p.ability && SPEED_ABILITIES.has(p.ability.toLowerCase());
      return hasScarf || hasSpeedAbility;
    });
    results.push({
      name: 'Fast Pokemon', icon: '💨',
      status: fastUsers.length > 0 ? 'pass' : 'warn',
      providers: fastUsers.map(p => p.species),
      detail: fastUsers.length > 0 ? null : 'No speed control (Choice Scarf or speed-boosting ability)',
    });

    // 3. Hazards
    const HAZARD_MOVE_IDS = new Set([
      'stealthrock', 'spikes', 'toxicspikes', 'stickyweb',
      'ceaselessedge', 'stoneaxe'
    ]);
    const hazardUsers = filledSlots.filter(p =>
      p.moves.some(m => m && HAZARD_MOVE_IDS.has(getMoveId(m)))
    );
    results.push({
      name: 'Hazards', icon: '🪨',
      status: hazardUsers.length > 0 ? 'pass' : 'fail',
      providers: hazardUsers.map(p => p.species),
      detail: hazardUsers.length > 0 ? null : 'No entry hazard moves',
    });

    // 4. Hazard Control (moves + Magic Bounce)
    const HAZARD_REMOVAL_IDS = new Set([
      'rapidspin', 'defog', 'courtchange', 'tidyup', 'mortalspin'
    ]);
    const hazardControlMoveUsers = filledSlots.filter(p =>
      p.moves.some(m => m && HAZARD_REMOVAL_IDS.has(getMoveId(m)))
    );
    const magicBouncers = filledSlots.filter(p =>
      p.ability && p.ability.toLowerCase() === 'magic bounce'
    );
    const allHazardControllers = [
      ...hazardControlMoveUsers,
      ...magicBouncers.filter(mb => !hazardControlMoveUsers.some(u => u.species === mb.species))
    ];
    const hazardControlStatus = hazardControlMoveUsers.length > 0 ? 'pass'
      : magicBouncers.length > 0 ? 'warn' : 'fail';
    results.push({
      name: 'Hazard Control', icon: '🧹',
      status: hazardControlStatus,
      providers: allHazardControllers.map(p => p.species),
      detail: hazardControlStatus === 'pass' ? null
        : hazardControlStatus === 'warn' ? 'Only Magic Bounce for hazard control — cannot remove existing hazards'
        : 'No hazard removal (Defog, Rapid Spin, Court Change, etc.) or Magic Bounce',
    });

    // 5. Toxic Spike Absorber
    const toxicAbsorbers = filledSlots.filter(p => {
      const types = getTypes(p.species);
      return types.some(t => t === 'Poison');
    });
    results.push({
      name: 'Toxic Spike Absorber', icon: '☠️',
      status: toxicAbsorbers.length > 0 ? 'pass' : 'warn',
      providers: toxicAbsorbers.map(p => p.species),
      detail: toxicAbsorbers.length > 0 ? null : 'No Poison-type to absorb Toxic Spikes on switch-in',
    });

    // 6. Status Immunity
    const STATUS_IMMUNE_ABILITIES = new Set([
      'natural cure', 'magic guard', 'magic bounce', 'overcoat',
      'immunity', 'insomnia', 'vital spirit', 'limber',
      'water veil', 'water bubble', 'magma armor', 'comatose',
      'purifying salt', 'thermal exchange', 'shields down',
      'good as gold'
    ]);
    const statusImmuneUsers = filledSlots.filter(p => {
      if (p.ability && STATUS_IMMUNE_ABILITIES.has(p.ability.toLowerCase())) return true;
      const types = getTypes(p.species);
      return types.some(t => ['Electric', 'Steel', 'Poison', 'Fire'].includes(t));
    });
    results.push({
      name: 'Status Immunity', icon: '🛡️',
      status: statusImmuneUsers.length >= 2 ? 'pass' : statusImmuneUsers.length >= 1 ? 'warn' : 'fail',
      providers: statusImmuneUsers.map(p => p.species),
      detail: statusImmuneUsers.length >= 2 ? null : 'Few Pokemon with status immunities (type-based or ability-based)',
    });

    // 7. Resistance to All Types
    const weaknesses = getTeamWeaknesses(teamMembers);
    const uncoveredTypes = weaknesses.filter(w => w.resistCount === 0 && w.weakCount > 0);
    results.push({
      name: 'All Types Resisted', icon: '🔰',
      status: uncoveredTypes.length === 0 ? 'pass' : uncoveredTypes.length <= 2 ? 'warn' : 'fail',
      providers: uncoveredTypes.length === 0 ? ['Full coverage'] : [],
      detail: uncoveredTypes.length > 0
        ? `Unresisted: ${uncoveredTypes.map(t => t.type).join(', ')}`
        : null,
    });

    // 8. Steel Type
    const steelUsers = filledSlots.filter(p => {
      const types = getTypes(p.species);
      return types.some(t => t === 'Steel');
    });
    results.push({
      name: 'Steel Type', icon: '⚙️',
      status: steelUsers.length > 0 ? 'pass' : 'warn',
      providers: steelUsers.map(p => p.species),
      detail: steelUsers.length > 0 ? null : 'No Steel-type (valuable Fairy/Ice/Rock resistances)',
    });

    // 9. Ground Immunity
    const groundImmuneUsers = filledSlots.filter(p => {
      const types = getTypes(p.species);
      const isFlying = types.some(t => t === 'Flying');
      const hasLevitate = p.ability && p.ability.toLowerCase() === 'levitate';
      const hasAirBalloon = p.item && p.item.toLowerCase() === 'air balloon';
      return isFlying || hasLevitate || hasAirBalloon;
    });
    results.push({
      name: 'Ground Immunity', icon: '🕊️',
      status: groundImmuneUsers.length > 0 ? 'pass' : 'fail',
      providers: groundImmuneUsers.map(p => p.species),
      detail: groundImmuneUsers.length > 0 ? null : 'No Ground immunity (Flying, Levitate, Air Balloon)',
    });

    // 10. Electric Immunity
    const ELEC_IMMUNE_ABILITIES = new Set(['lightning rod', 'volt absorb', 'motor drive']);
    const elecImmuneUsers = filledSlots.filter(p => {
      const types = getTypes(p.species);
      const isGround = types.some(t => t === 'Ground');
      const hasAbility = p.ability && ELEC_IMMUNE_ABILITIES.has(p.ability.toLowerCase());
      return isGround || hasAbility;
    });
    results.push({
      name: 'Electric Immunity', icon: '🔌',
      status: elecImmuneUsers.length > 0 ? 'pass' : 'warn',
      providers: elecImmuneUsers.map(p => p.species),
      detail: elecImmuneUsers.length > 0 ? null : 'No Electric immunity (Ground type, Volt Absorb, Lightning Rod, Motor Drive)',
    });

    // 11. Pivoting Moves
    const PIVOT_MOVE_IDS = new Set([
      'uturn', 'voltswitch', 'flipturn', 'teleport',
      'partingshot', 'batonpass', 'chillyreception', 'shedtail'
    ]);
    const pivotUsers = filledSlots.filter(p =>
      p.moves.some(m => m && PIVOT_MOVE_IDS.has(getMoveId(m)))
    );
    results.push({
      name: 'Pivoting Moves', icon: '🔄',
      status: pivotUsers.length > 0 ? 'pass' : 'warn',
      providers: pivotUsers.map(p => p.species),
      detail: pivotUsers.length > 0 ? null : 'No pivoting moves (U-turn, Volt Switch, Flip Turn, Teleport, etc.)',
    });

    // 12. Knock Off User
    const knockOffUsers = filledSlots.filter(p =>
      p.moves.some(m => m && getMoveId(m) === 'knockoff')
    );
    results.push({
      name: 'Knock Off User', icon: '✋',
      status: knockOffUsers.length > 0 ? 'pass' : 'warn',
      providers: knockOffUsers.map(p => p.species),
      detail: knockOffUsers.length > 0 ? null : 'No Knock Off users for item removal',
    });

    // 13. Knock Off Absorber (Dark resists: Fighting, Dark, Fairy)
    const knockAbsorbers = filledSlots.filter(p => {
      const types = getTypes(p.species);
      return types.some(t => ['Fighting', 'Dark', 'Fairy'].includes(t));
    });
    results.push({
      name: 'Knock Off Absorber', icon: '🧤',
      status: knockAbsorbers.length > 0 ? 'pass' : 'warn',
      providers: knockAbsorbers.map(p => p.species),
      detail: knockAbsorbers.length > 0 ? null : 'No Dark resists (Fighting, Dark, Fairy) to absorb Knock Off',
    });

    // 14. Contact Punisher
    const CONTACT_PUNISH_ABILITIES = new Set([
      'iron barbs', 'rough skin', 'flame body', 'static',
      'effect spore', 'poison point', 'gooey', 'tangling hair',
      'wandering spirit'
    ]);
    const contactPunishers = filledSlots.filter(p => {
      const hasHelmet = p.item && p.item.toLowerCase() === 'rocky helmet';
      const hasAbility = p.ability && CONTACT_PUNISH_ABILITIES.has(p.ability.toLowerCase());
      return hasHelmet || hasAbility;
    });
    results.push({
      name: 'Contact Punisher', icon: '🦔',
      status: contactPunishers.length > 0 ? 'pass' : 'warn',
      providers: contactPunishers.map(p => p.species),
      detail: contactPunishers.length > 0 ? null : 'No contact punisher (Rocky Helmet, Iron Barbs, Rough Skin, etc.)',
    });

    // 15. Immediate Power
    const POWER_ITEMS = new Set(['choice band', 'choice specs', 'life orb']);
    const powerUsers = filledSlots.filter(p =>
      p.item && POWER_ITEMS.has(p.item.toLowerCase())
    );
    results.push({
      name: 'Immediate Power', icon: '💥',
      status: powerUsers.length > 0 ? 'pass' : 'warn',
      providers: powerUsers.map(p => p.species),
      detail: powerUsers.length > 0 ? null : 'No immediate power (Choice Band, Choice Specs, Life Orb)',
    });

    // 16. Breaking Core (boosting moves or multiple offensive threats)
    const BOOST_MOVE_IDS = new Set([
      'swordsdance', 'nastyplot', 'calmmind', 'dragondance',
      'quiverdance', 'shellsmash', 'bellydrum', 'bulkup',
      'irondefense body press combo', 'tailglow', 'growth',
      'shiftgear', 'coil', 'curse', 'agility', 'autotomize',
      'tidyup', 'victorydance', 'filletaway', 'noretreat',
      'clangoroussoul'
    ]);
    const breakers = filledSlots.filter(p => {
      const hasBoost = p.moves.some(m => m && BOOST_MOVE_IDS.has(getMoveId(m)));
      const hasPowerItem = p.item && POWER_ITEMS.has(p.item.toLowerCase());
      return hasBoost || hasPowerItem;
    });
    results.push({
      name: 'Breaking Core', icon: '🔨',
      status: breakers.length >= 2 ? 'pass' : breakers.length >= 1 ? 'warn' : 'fail',
      providers: breakers.map(p => p.species),
      detail: breakers.length >= 2 ? null : 'Need 2+ wallbreakers (boosting moves or Choice/LO items)',
    });

    // 17. Physical & Special Attackers
    const physicalAttackers = filledSlots.filter(p =>
      p.moves.some(m => {
        if (!m) return false;
        const move = getMove(m);
        return move && move.category === 'Physical' && (move.basePower || 0) > 0;
      })
    );
    const specialAttackers = filledSlots.filter(p =>
      p.moves.some(m => {
        if (!m) return false;
        const move = getMove(m);
        return move && move.category === 'Special' && (move.basePower || 0) > 0;
      })
    );
    const hasPhysical = physicalAttackers.length > 0;
    const hasSpecial = specialAttackers.length > 0;
    results.push({
      name: 'Physical & Special', icon: '⚔️',
      status: hasPhysical && hasSpecial ? 'pass' : 'fail',
      providers: [
        ...physicalAttackers.map(p => `${p.species} (Phys)`),
        ...specialAttackers.map(p => `${p.species} (Spec)`),
      ],
      detail: !hasPhysical ? 'No physical attackers' : !hasSpecial ? 'No special attackers' : null,
    });

    return results;
  }, [pokemon, teamMembers, teamTypes, moveData]);

  // Build pokemon-name → types map for all candidates in chaos data
  const chaosTypeMap = useMemo(() => {
    if (!pokedex || !chaosData?.data) return {};
    const map = {};
    for (const name of Object.keys(chaosData.data)) {
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (pokedex[id]?.types) map[name] = pokedex[id].types;
    }
    return map;
  }, [pokedex, chaosData]);

  // For each failing/warn check, find the top-5 format Pokemon that would fill the role
  const roleSuggestions = useMemo(() => {
    if (!chaosData?.data || !checks.length) return {};
    const onTeam = new Set(teamMembers.map(m => m.species));
    const result = {};

    for (const check of checks) {
      if (check.status === 'pass') continue;
      const candidates = [];

      for (const [name, data] of Object.entries(chaosData.data)) {
        if (onTeam.has(name)) continue;
        if (!data.usage || data.usage < 0.001) continue;

        const abilitySum  = Object.values(data.Abilities || {}).reduce((s, v) => s + v, 0) || 1;
        const moveEntries = Object.entries(data.Moves || {});
        const moveDenom   = moveEntries.reduce((s, [, v]) => s + v, 0) / 4 || 1;
        const itemSum     = Object.values(data.Items || {}).reduce((s, v) => s + v, 0) || 1;
        const types       = chaosTypeMap[name] || [];

        const hasMove     = (id)    => (data.Moves?.[id]    || 0) / moveDenom   > 0.10;
        const hasMoveAny  = (...ids) => ids.some(hasMove);
        const hasAbility  = (id)    => (data.Abilities?.[id] || 0) / abilitySum > 0.30;
        const hasAbilAny  = (...ids) => ids.some(hasAbility);
        const hasItem     = (id)    => (data.Items?.[id]    || 0) / itemSum     > 0.12;
        const hasType     = (t)     => types.includes(t);
        const hasTypeAny  = (...ts)  => ts.some(hasType);

        let qualifies = false;
        switch (check.name) {
          case 'Priority':
            qualifies = hasMoveAny('extremespeed','aquajet','bulletpunch','iceshard','machpunch',
              'shadowsneak','accelerock','grassyglide','jetpunch','quickattack',
              'firstimpression','watershuriken','suckerpunch','thunderclap','fakeout');
            break;
          case 'Fast Pokemon':
            qualifies = hasAbilAny('speedboost','swiftswim','chlorophyll','sandrush',
              'slushrush','unburden','protosynthesis','quarkdrive') || hasItem('choicescarf');
            break;
          case 'Hazards':
            qualifies = hasMoveAny('stealthrock','spikes','toxicspikes','stickyweb','ceaselessedge','stoneaxe');
            break;
          case 'Hazard Control':
            qualifies = hasMoveAny('rapidspin','defog','courtchange','tidyup','mortalspin') || hasAbility('magicbounce');
            break;
          case 'Toxic Spike Absorber':
            qualifies = hasType('Poison');
            break;
          case 'Status Immunity':
            qualifies = hasAbilAny('naturalcure','magicguard','magicbounce','overcoat',
              'immunity','insomnia','vitalspirit','limber','waterveil','waterbubble',
              'comatose','purifyingsalt','thermalexchange','goodasgold');
            break;
          case 'Steel Type':
            qualifies = hasType('Steel');
            break;
          case 'Ground Immunity':
            qualifies = hasType('Flying') || hasAbility('levitate');
            break;
          case 'Electric Immunity':
            qualifies = hasType('Ground') || hasAbilAny('lightningrod','voltabsorb','motordrive');
            break;
          case 'Pivoting Moves':
            qualifies = hasMoveAny('uturn','voltswitch','flipturn','teleport',
              'partingshot','batonpass','chillyreception','shedtail');
            break;
          case 'Knock Off User':
            qualifies = hasMove('knockoff');
            break;
          case 'Knock Off Absorber':
            qualifies = hasTypeAny('Fighting','Dark','Fairy');
            break;
          case 'Contact Punisher':
            qualifies = hasAbilAny('ironbarbs','roughskin','flamebody','static',
              'effectspore','poisonpoint','gooey','tanglinghair','wanderingspirit')
              || hasItem('rockyhelmet');
            break;
          case 'Immediate Power':
            qualifies = hasItem('choiceband') || hasItem('choicespecs') || hasItem('lifeorb');
            break;
          case 'Breaking Core':
            qualifies = hasMoveAny('swordsdance','nastyplot','calmmind','dragondance',
              'quiverdance','shellsmash','bellydrum','bulkup','tailglow','growth',
              'shiftgear','victorydance','filletaway','clangoroussoul');
            break;
          case 'Physical & Special':
            if (moveData) {
              const need = check.detail === 'No special attackers' ? 'Special' : 'Physical';
              qualifies = moveEntries.some(([id, v]) => {
                const move = moveData[id];
                return move && move.category === need && (move.basePower || 0) > 0 && v / moveDenom > 0.10;
              });
            }
            break;
          default: break;
        }

        if (qualifies) candidates.push({ name, usage: data.usage });
      }

      result[check.name] = candidates.sort((a, b) => b.usage - a.usage).slice(0, 5);
    }
    return result;
  }, [checks, chaosData, chaosTypeMap, moveData, teamMembers]);

  if (teamMembers.length === 0) return null;
  if (!moveData) {
    return (
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading move data for checklist...
        </div>
      </div>
    );
  }

  const passCount = checks.filter(c => c.status === 'pass').length;
  const totalCount = checks.length;

  return (
    <div className="glass-panel p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white text-sm">📋 Team Role Checklist</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          passCount >= totalCount - 2 ? 'bg-emerald-500/20 text-emerald-400' :
          passCount >= totalCount / 2 ? 'bg-amber-500/20 text-amber-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {passCount}/{totalCount}
        </span>
      </div>
      <div className="space-y-1">
        {checks.map(check => (
          <div key={check.name} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm ${
            check.status === 'pass' ? 'bg-emerald-900/10' :
            check.status === 'warn' ? 'bg-amber-900/10' :
            'bg-red-900/10'
          }`}>
            <span className="flex-shrink-0 w-5 text-center mt-0.5">
              {check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'}
            </span>
            <div className="flex-1 min-w-0">
              <span className={`font-medium ${
                check.status === 'pass' ? 'text-emerald-300' :
                check.status === 'warn' ? 'text-amber-300' :
                'text-red-300'
              }`}>
                {check.icon} {check.name}
              </span>
              {check.providers.length > 0 && check.status === 'pass' && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {check.providers.join(', ')}
                </p>
              )}
              {check.detail && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {check.detail}
                </p>
              )}
              {check.status !== 'pass' && roleSuggestions[check.name]?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wide shrink-0">Try:</span>
                  {roleSuggestions[check.name].map(s => {
                    const spriteId = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return (
                      <span
                        key={s.name}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600/30 text-[11px] text-slate-300 cursor-default"
                        title={`${(s.usage * 100).toFixed(1)}% usage in format`}
                      >
                        <img
                          src={`https://play.pokemonshowdown.com/sprites/dex/${spriteId}.png`}
                          alt=""
                          className="w-4 h-4 object-contain"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        {s.name}
                        <span className="text-slate-500 text-[10px]">{(s.usage * 100).toFixed(1)}%</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600 mt-3">
        ✅ covered · ⚠️ nice to have · ❌ important, missing
      </p>
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
