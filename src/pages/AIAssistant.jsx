import { useState, useEffect, useRef, useMemo } from 'react';
import { useTeam } from '../context/TeamContext';
import { useApp } from '../context/AppContext';
import { getPokemonTypes } from '../services/showdownData';
import { fetchChaosData, getUsageListFromChaos, getPokemonFromChaos } from '../services/smogonApi';
import { TypeBadgeRow } from '../components/TypeBadge';
import TypeBadge from '../components/TypeBadge';
import { getTeamWeaknesses, suggestDefensiveTypes, calculateSynergyScore } from '../utils/typeAnalysis';
import { TYPE_LIST, getTypeMatchups } from '../data/typeChart';
import { exportTeamToShowdown } from '../utils/exportShowdown';
import { sortByValue } from '../utils/helpers';
import { isMonotypeFormat } from '../data/formats';

export default function AIAssistant() {
  const { currentTeam } = useTeam();
  const { format, formatId: globalFormatId, aiApiKey, setAiKey, aiProvider, setAiProvider } = useApp();
  const [teamTypes, setTeamTypes] = useState({});
  const [chaosData, setChaosData] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');
  const chatEndRef = useRef(null);

  // Use the team's stored format if available, otherwise fall back to global format
  const teamFormatId = currentTeam.formatId || globalFormatId;
  const formatId = teamFormatId;
  const effectiveMonth = currentTeam.format?.month || format.month;
  const effectiveRating = currentTeam.format?.rating || format.rating;

  // Load types for team members
  useEffect(() => {
    async function load() {
      const types = {};
      for (const p of currentTeam.pokemon) {
        if (p.species) {
          try {
            const t = await getPokemonTypes(p.species);
            if (t.length) types[p.species] = t;
          } catch (e) {}
        }
      }
      setTeamTypes(types);
    }
    load();
  }, [currentTeam.pokemon]);

  // Load chaos data for suggestions — use team's format
  useEffect(() => {
    fetchChaosData(effectiveMonth, formatId, effectiveRating)
      .then(setChaosData)
      .catch(() => {});
  }, [effectiveMonth, formatId, effectiveRating]);

  const teamMembers = currentTeam.pokemon
    .filter(p => p.species)
    .map(p => ({
      species: p.species,
      types: teamTypes[p.species] || [],
    }));

  const weaknesses = teamMembers.length > 0 ? getTeamWeaknesses(teamMembers) : [];
  const synergyScore = teamMembers.length >= 2 ? calculateSynergyScore(teamMembers) : null;

  // Detect monotype: if all team members share a common type, use it as constraint
  const detectedMonoType = useMemo(() => {
    if (!isMonotypeFormat(formatId) || teamMembers.length === 0) return null;
    const membersWithTypes = teamMembers.filter(m => m.types.length > 0);
    if (membersWithTypes.length === 0) return null;
    // Find the type shared by ALL members
    const firstTypes = membersWithTypes[0].types;
    for (const type of firstTypes) {
      if (membersWithTypes.every(m => m.types.some(t => t.toLowerCase() === type.toLowerCase()))) {
        return type;
      }
    }
    return null;
  }, [formatId, teamMembers]);

  const typeSuggestions = teamMembers.length >= 2 ? suggestDefensiveTypes(teamMembers, detectedMonoType) : [];

  // Biggest threats: top usage Pokemon whose types the team is weak to
  const biggestThreats = useMemo(() => {
    if (!chaosData || teamMembers.length === 0) return [];

    const criticalWeaknesses = weaknesses
      .filter(w => w.score > 0)
      .map(w => w.type);

    const usageList = getUsageListFromChaos(chaosData);
    const threats = [];

    for (const pokemon of usageList.slice(0, 50)) {
      const pData = getPokemonFromChaos(chaosData, pokemon.name);
      if (!pData) continue;

      // Check if this Pokemon has STAB moves that exploit team weaknesses
      const moves = pData.Moves ? Object.keys(pData.Moves) : [];
      // Simple heuristic: check Pokemon types from our teamTypes or infer
      // For now just flag Pokemon with high usage as potential threats
      threats.push({
        name: pokemon.name,
        usage: pokemon.usage,
        reason: 'High usage in format',
      });

      if (threats.length >= 10) break;
    }

    return threats;
  }, [chaosData, weaknesses, teamMembers]);

  // Teammate suggestions from data
  const teammateSuggestions = useMemo(() => {
    if (!chaosData || teamMembers.length === 0) return [];

    const allTeammates = {};

    for (const member of teamMembers) {
      const pData = getPokemonFromChaos(chaosData, member.species);
      if (!pData || !pData.Teammates) continue;

      // Use weighted count (sum of Abilities) as denominator — teammate values are differentials
      const abilityValues = Object.values(pData.Abilities || {});
      const weightedCount = abilityValues.reduce((s, v) => s + v, 0) || 1;

      for (const [name, value] of Object.entries(pData.Teammates)) {
        if (teamMembers.some(m => m.species === name)) continue; // skip already on team
        if (!allTeammates[name]) allTeammates[name] = { totalPct: 0, fromPokemon: [] };
        // Convert to differential percentage using weighted count
        allTeammates[name].totalPct += (value / weightedCount) * 100;
        allTeammates[name].fromPokemon.push(member.species);
      }
    }

    return Object.entries(allTeammates)
      .map(([name, data]) => ({ name, pct: data.totalPct / teamMembers.length, fromPokemon: data.fromPokemon }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [chaosData, teamMembers]);

  // AI Chat
  async function sendMessage() {
    if (!chatInput.trim() || !aiApiKey) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const teamExport = exportTeamToShowdown(currentTeam.pokemon);
      const systemPrompt = `You are a competitive Pokémon expert assistant. The user has the following team:

${teamExport || 'No team configured yet.'}

Format: ${formatId} (${effectiveMonth})

Help them with team building, strategy, matchup analysis, and suggestions. Be concise and specific.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ];

      let response;

      if (aiProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            max_tokens: 1000,
          }),
        });
        const data = await res.json();
        response = data.choices?.[0]?.message?.content || 'No response received.';
      } else {
        // Anthropic
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': aiApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: systemPrompt,
            messages: [
              ...chatMessages.map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: userMessage },
            ],
          }),
        });
        const data = await res.json();
        response = data.content?.[0]?.text || 'No response received.';
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${e.message}. Please check your API key.`,
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const TABS = [
    { id: 'analysis', label: 'Team Analysis', icon: '🔍' },
    { id: 'suggestions', label: 'Suggestions', icon: '💡' },
    { id: 'threats', label: 'Threats', icon: '⚠️' },
    { id: 'chat', label: 'AI Chat', icon: '🤖' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">AI Assistant</h1>
        <p className="text-sm text-slate-400">
          Analyze your team's strengths and weaknesses, get suggestions, and chat with AI for strategy help.
        </p>
      </div>

      {/* Current Team Summary */}
      <div className="glass-panel p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Current Team: {currentTeam.name}</h3>
          {synergyScore !== null && (
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
              synergyScore >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
              synergyScore >= 40 ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              Synergy: {synergyScore}%
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {currentTeam.pokemon.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-2 py-1">
              {p.species ? (
                <>
                  <img
                    src={`https://play.pokemonshowdown.com/sprites/dex/${p.species.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                    alt={p.species}
                    className="w-6 h-6 object-contain"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <span className="text-sm text-white">{p.species}</span>
                  <TypeBadgeRow types={teamTypes[p.species] || []} size="xs" />
                </>
              ) : (
                <span className="text-sm text-slate-600">Empty</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-900/50 p-1 rounded-lg border border-slate-800 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all
              ${activeTab === tab.id
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {teamMembers.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <p className="text-slate-400 text-lg mb-2">No team to analyze</p>
              <p className="text-sm text-slate-500">Add Pokémon to your team in the Team Builder to see analysis here.</p>
            </div>
          ) : (
            <>
              {/* Weakness Chart */}
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  🛡️ Defensive Coverage
                </h3>
                <div className="space-y-2">
                  {weaknesses.filter(w => w.score > 0).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-400 uppercase mb-2">Weaknesses (Unresisted)</h4>
                      <div className="flex flex-wrap gap-2">
                        {weaknesses.filter(w => w.score > 0).map(w => (
                          <div key={w.type} className="flex items-center gap-1.5 bg-red-900/20 border border-red-800/30 rounded-lg px-2 py-1">
                            <TypeBadge type={w.type} size="xs" />
                            <span className="text-xs text-red-400 font-mono">
                              {w.weakCount}W / {w.resistCount}R
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {weaknesses.filter(w => w.score <= 0).length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-emerald-400 uppercase mb-2">Well Covered</h4>
                      <div className="flex flex-wrap gap-2">
                        {weaknesses.filter(w => w.score < 0).map(w => (
                          <div key={w.type} className="flex items-center gap-1.5 bg-emerald-900/20 border border-emerald-800/30 rounded-lg px-2 py-1">
                            <TypeBadge type={w.type} size="xs" />
                            <span className="text-xs text-emerald-400 font-mono">
                              {w.weakCount}W / {w.resistCount}R
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Per-Pokemon matchups */}
              <div className="glass-panel p-5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  📋 Individual Weaknesses
                </h3>
                <div className="space-y-4">
                  {teamMembers.map(member => {
                    if (member.types.length === 0) return null;
                    const matchups = getTypeMatchups(member.types);
                    const weakTo = TYPE_LIST.filter(t => matchups[t] > 1);
                    const resistTo = TYPE_LIST.filter(t => matchups[t] < 1 && matchups[t] > 0);
                    const immuneTo = TYPE_LIST.filter(t => matchups[t] === 0);

                    return (
                      <div key={member.species} className="bg-slate-800/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={`https://play.pokemonshowdown.com/sprites/dex/${member.species.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                            alt={member.species}
                            className="w-8 h-8 object-contain"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                          <span className="font-medium text-white text-sm">{member.species}</span>
                          <TypeBadgeRow types={member.types} size="xs" />
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {weakTo.length > 0 && (
                            <div>
                              <span className="text-red-400 mr-1">Weak:</span>
                              {weakTo.map(t => <TypeBadge key={t} type={t} size="xs" className="mr-1" />)}
                            </div>
                          )}
                          {immuneTo.length > 0 && (
                            <div>
                              <span className="text-emerald-400 mr-1">Immune:</span>
                              {immuneTo.map(t => <TypeBadge key={t} type={t} size="xs" className="mr-1" />)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className="space-y-6">
          {/* Type suggestions */}
          {typeSuggestions.length > 0 && (
            <div className="glass-panel p-5">
              <h3 className="font-semibold text-white mb-4">🧩 Recommended Type Combos to Add</h3>
              <p className="text-xs text-slate-500 mb-3">
                Types that would help cover your team's weaknesses.
                {detectedMonoType && (
                  <span className="ml-1 text-blue-400">
                    (filtered for {detectedMonoType}-type monotype)
                  </span>
                )}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {typeSuggestions.slice(0, 6).map((s, i) => (
                  <div key={i} className="bg-slate-800/40 rounded-lg p-3">
                    <TypeBadgeRow types={s.types} size="sm" className="mb-2" />
                    <p className="text-xs text-slate-400">
                      Resists: {s.resistedWeaknesses.map(t => t).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teammate suggestions from data */}
          {teammateSuggestions.length > 0 && (
            <div className="glass-panel p-5">
              <h3 className="font-semibold text-white mb-4">🤝 Suggested Teammates (from Stats)</h3>
              <p className="text-xs text-slate-500 mb-3">
                Pokémon commonly paired with your team members in {formatId}.
              </p>
              <div className="space-y-2">
                {teammateSuggestions.map(s => (
                  <div key={s.name} className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-2">
                    <img
                      src={`https://play.pokemonshowdown.com/sprites/dex/${s.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                      alt={s.name}
                      className="w-8 h-8 object-contain"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-white">{s.name}</span>
                      <p className="text-xs text-slate-500">
                        Common with: {s.fromPokemon.join(', ')}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">
                      {s.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {teamMembers.length === 0 && (
            <div className="glass-panel p-8 text-center">
              <p className="text-slate-400">Add Pokémon to your team to get suggestions.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'threats' && (
        <div className="glass-panel p-5">
          <h3 className="font-semibold text-white mb-4">⚠️ Format Threats</h3>
          <p className="text-xs text-slate-500 mb-4">
            Top usage Pokémon in {formatId} ({effectiveMonth}) that could threaten your team.
          </p>
          {biggestThreats.length > 0 ? (
            <div className="space-y-2">
              {biggestThreats.map(t => (
                <div key={t.name} className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-2">
                  <img
                    src={`https://play.pokemonshowdown.com/sprites/dex/${t.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`}
                    alt={t.name}
                    className="w-10 h-10 object-contain"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-white">{t.name}</span>
                    <p className="text-xs text-slate-500">{t.reason}</p>
                  </div>
                  <span className="text-xs font-mono text-amber-400">
                    {(t.usage * 100).toFixed(1)}% usage
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading threat data...</p>
          )}
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="space-y-4">
          {/* API Key Config */}
          <div className="glass-panel p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">🔑 AI Configuration</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Provider</label>
                <select
                  value={aiProvider}
                  onChange={e => setAiProvider(e.target.value)}
                  className="select-field text-sm"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">API Key</label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={e => setAiKey(e.target.value)}
                  className="input-field text-sm"
                  placeholder="Enter your API key..."
                />
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Your API key is stored locally and never sent anywhere except the AI provider. Calls are made directly from your browser.
            </p>
          </div>

          {/* Chat */}
          <div className="glass-panel flex flex-col" style={{ height: '500px' }}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-slate-500 py-12">
                  <p className="text-lg mb-2">🤖</p>
                  <p className="text-sm">Ask me about your team's strategy, weaknesses, or matchups!</p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {[
                      'What are my team\'s biggest weaknesses?',
                      'Suggest a good lead for my team',
                      'How should I handle stall teams?',
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => { setChatInput(q); }}
                        className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full hover:bg-slate-700 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-200'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-700/50 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  className="input-field flex-1"
                  placeholder={aiApiKey ? 'Ask about your team...' : 'Enter an API key above to chat'}
                  disabled={!aiApiKey || chatLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!aiApiKey || !chatInput.trim() || chatLoading}
                  className="btn-primary text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
