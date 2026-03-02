import { useState, useEffect, useRef, useCallback } from 'react';
import { useTeam } from '../context/TeamContext';
import { useApp } from '../context/AppContext';
import { exportTeamToShowdown, importTeamFromShowdown, createEmptyPokemon } from '../utils/exportShowdown';
import { searchPokemon, searchMoves, searchItems, getPokemonAbilities, getPokemonTypes } from '../services/showdownData';
import { TypeBadgeRow } from '../components/TypeBadge';
import TypeBadge from '../components/TypeBadge';
import { BaseStatBar } from '../components/StatBar';
import { NATURES, ALL_TYPES } from '../data/formats';
import { getTypeMatchups, TYPE_LIST } from '../data/typeChart';
import { generateTypeMatrix, calculateSynergyScore, getTeamWeaknesses } from '../utils/typeAnalysis';
import { getEffectivenessClass, getEffectivenessLabel, debounce } from '../utils/helpers';

export default function TeamBuilder() {
  const {
    teams, currentTeamIndex, currentTeam,
    setPokemon, clearSlot, setTeamName, addTeam, deleteTeam, selectTeam, importTeam
  } = useTeam();
  const { format } = useApp();
  const [editingSlot, setEditingSlot] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [teamTypes, setTeamTypes] = useState({});

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
            Build your team and export to Pokémon Showdown format.
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

      {/* Type Analysis */}
      {showAnalysis && teamMembers.length >= 1 && (
        <TypeAnalysisPanel teamMembers={teamMembers} />
      )}

      {/* Pokemon Editor Modal */}
      {editingSlot !== null && (
        <PokemonEditorModal
          slot={currentTeam.pokemon[editingSlot]}
          slotIndex={editingSlot}
          onSave={(pokemon) => { setPokemon(editingSlot, pokemon); setEditingSlot(null); }}
          onClose={() => setEditingSlot(null)}
        />
      )}

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          team={currentTeam}
          onClose={() => setShowExport(false)}
        />
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

function TeamSlotCard({ slot, index, types, onEdit, onClear }) {
  const isEmpty = !slot.species;
  const spriteUrl = slot.species
    ? `https://play.pokemonshowdown.com/sprites/dex/${slot.species.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`
    : null;

  return (
    <div
      className={`glass-panel p-4 transition-all duration-200 group
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

function PokemonEditorModal({ slot, slotIndex, onSave, onClose }) {
  const [pokemon, setPokemonState] = useState({ ...createEmptyPokemon(), ...slot });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [moveSearches, setMoveSearches] = useState(['', '', '', '']);
  const [moveResults, setMoveResults] = useState([[], [], [], []]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState([]);
  const [availableAbilities, setAvailableAbilities] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');

  // Search Pokemon
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const results = await searchPokemon(searchQuery);
      setSearchResults(results);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load abilities when species changes
  useEffect(() => {
    if (pokemon.species) {
      getPokemonAbilities(pokemon.species).then(setAvailableAbilities);
    }
  }, [pokemon.species]);

  function selectPokemon(p) {
    setPokemonState(prev => ({ ...prev, species: p.name }));
    setSearchQuery('');
    setSearchResults([]);
  }

  function updateMove(index, value) {
    const moves = [...pokemon.moves];
    moves[index] = value;
    setPokemonState(prev => ({ ...prev, moves }));
  }

  async function searchMoveForSlot(index, query) {
    const searches = [...moveSearches];
    searches[index] = query;
    setMoveSearches(searches);

    if (query.length < 2) {
      const results = [...moveResults];
      results[index] = [];
      setMoveResults(results);
      return;
    }

    const results = await searchMoves(query);
    setMoveResults(prev => {
      const newResults = [...prev];
      newResults[index] = results;
      return newResults;
    });
  }

  async function searchItemFn(query) {
    setItemSearch(query);
    if (query.length < 2) { setItemResults([]); return; }
    const results = await searchItems(query);
    setItemResults(results);
  }

  function updateEV(stat, value) {
    const val = Math.max(0, Math.min(252, parseInt(value) || 0));
    setPokemonState(prev => ({
      ...prev,
      evs: { ...prev.evs, [stat]: val }
    }));
  }

  const totalEVs = Object.values(pokemon.evs).reduce((a, b) => a + b, 0);

  const EDIT_TABS = [
    { id: 'basic', label: 'Basic' },
    { id: 'moves', label: 'Moves' },
    { id: 'evs', label: 'EVs/IVs' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass-panel w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700/50 p-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-white">
            {pokemon.species || `Slot ${slotIndex + 1}`}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => onSave(pokemon)} className="btn-primary text-sm">Save</button>
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>

        <div className="p-4">
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg">
            {EDIT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                  ${activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'basic' && (
            <div className="space-y-4">
              {/* Species Search */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Pokémon</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery || pokemon.species}
                    onChange={e => { setSearchQuery(e.target.value); }}
                    onFocus={() => setSearchQuery(pokemon.species || '')}
                    className="input-field"
                    placeholder="Search Pokémon..."
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-20">
                      {searchResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => selectPokemon(p)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <img
                            src={`https://play.pokemonshowdown.com/sprites/dex/${p.id}.png`}
                            alt={p.name}
                            className="w-8 h-8 object-contain"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                          <span className="text-white">{p.name}</span>
                          <TypeBadgeRow types={p.types} size="xs" className="ml-auto" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Item */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Item</label>
                <div className="relative">
                  <input
                    type="text"
                    value={itemSearch || pokemon.item}
                    onChange={e => searchItemFn(e.target.value)}
                    onFocus={() => setItemSearch(pokemon.item || '')}
                    className="input-field"
                    placeholder="Search items..."
                  />
                  {itemResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-20">
                      {itemResults.map(item => (
                        <button
                          key={item.id}
                          onClick={() => { setPokemonState(p => ({ ...p, item: item.name })); setItemSearch(''); setItemResults([]); }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors"
                        >
                          <span className="text-white">{item.name}</span>
                          {item.desc && <span className="text-xs text-slate-500 ml-2">{item.desc}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ability */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ability</label>
                <select
                  value={pokemon.ability}
                  onChange={e => setPokemonState(p => ({ ...p, ability: e.target.value }))}
                  className="select-field"
                >
                  <option value="">Select ability...</option>
                  {availableAbilities.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Nature */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nature</label>
                <select
                  value={pokemon.nature}
                  onChange={e => setPokemonState(p => ({ ...p, nature: e.target.value }))}
                  className="select-field"
                >
                  <option value="">Select nature...</option>
                  {NATURES.map(n => (
                    <option key={n.name} value={n.name}>
                      {n.name}{n.plus ? ` (+${n.plus.toUpperCase()} / -${n.minus.toUpperCase()})` : ' (Neutral)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tera Type */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tera Type</label>
                <select
                  value={pokemon.teraType}
                  onChange={e => setPokemonState(p => ({ ...p, teraType: e.target.value }))}
                  className="select-field"
                >
                  <option value="">Select Tera Type...</option>
                  {ALL_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Level</label>
                  <input
                    type="number"
                    value={pokemon.level}
                    onChange={e => setPokemonState(p => ({ ...p, level: parseInt(e.target.value) || 100 }))}
                    className="input-field"
                    min="1"
                    max="100"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pokemon.shiny}
                      onChange={e => setPokemonState(p => ({ ...p, shiny: e.target.checked }))}
                      className="rounded border-slate-600"
                    />
                    Shiny
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'moves' && (
            <div className="space-y-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Move {i + 1}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={moveSearches[i] || pokemon.moves[i] || ''}
                      onChange={e => searchMoveForSlot(i, e.target.value)}
                      onFocus={() => {
                        const s = [...moveSearches];
                        s[i] = pokemon.moves[i] || '';
                        setMoveSearches(s);
                      }}
                      className="input-field"
                      placeholder={`Move ${i + 1}...`}
                    />
                    {moveResults[i]?.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-20">
                        {moveResults[i].map(move => (
                          <button
                            key={move.id}
                            onClick={() => {
                              updateMove(i, move.name);
                              const s = [...moveSearches];
                              s[i] = '';
                              setMoveSearches(s);
                              setMoveResults(prev => {
                                const r = [...prev];
                                r[i] = [];
                                return r;
                              });
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
                          >
                            <TypeBadge type={move.type} size="xs" />
                            <span className="text-white">{move.name}</span>
                            <span className="text-xs text-slate-500 ml-auto">
                              {move.category} · {move.basePower || '—'} BP
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'evs' && (
            <div className="space-y-6">
              {/* EVs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-slate-300 uppercase">EVs</label>
                  <span className={`text-xs font-mono ${totalEVs > 510 ? 'text-red-400' : 'text-slate-400'}`}>
                    {totalEVs}/510
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(stat => (
                    <div key={stat}>
                      <label className="block text-xs text-slate-500 mb-1 uppercase">{stat}</label>
                      <input
                        type="number"
                        value={pokemon.evs[stat]}
                        onChange={e => updateEV(stat, e.target.value)}
                        className="input-field text-sm font-mono"
                        min="0"
                        max="252"
                        step="4"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* IVs */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-3">IVs</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(stat => (
                    <div key={stat}>
                      <label className="block text-xs text-slate-500 mb-1 uppercase">{stat}</label>
                      <input
                        type="number"
                        value={pokemon.ivs[stat]}
                        onChange={e => setPokemonState(p => ({
                          ...p,
                          ivs: { ...p.ivs, [stat]: Math.max(0, Math.min(31, parseInt(e.target.value) || 0)) }
                        }))}
                        className="input-field text-sm font-mono"
                        min="0"
                        max="31"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
          <textarea
            readOnly
            value={exportText}
            className="input-field font-mono text-sm h-64 resize-none"
            onClick={e => e.target.select()}
          />
          <div className="mt-3 flex justify-end">
            <button onClick={copyToClipboard} className={`btn-primary text-sm ${copied ? '!bg-emerald-600' : ''}`}>
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      // Pad to 6 slots
      while (pokemon.length < 6) {
        pokemon.push(createEmptyPokemon());
      }
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
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setError(''); }}
            className="input-field font-mono text-sm h-64 resize-none"
            placeholder="Paste your Showdown team here..."
          />
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

function TypeAnalysisPanel({ teamMembers }) {
  const matrix = generateTypeMatrix(teamMembers);
  const weaknesses = getTeamWeaknesses(teamMembers);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Weakness Overview */}
      <div className="glass-panel p-5">
        <h3 className="font-semibold text-white mb-4 text-sm">🛡️ Team Weakness Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {weaknesses.map(({ type, weakCount, resistCount, score }) => (
            <div
              key={type}
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

      {/* Type Matrix */}
      <div className="glass-panel p-5 overflow-x-auto">
        <h3 className="font-semibold text-white mb-4 text-sm">📊 Defensive Type Chart</h3>
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
                <td className="p-1">
                  <TypeBadge type={row.attackType} size="xs" />
                </td>
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
