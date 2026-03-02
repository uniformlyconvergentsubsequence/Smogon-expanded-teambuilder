/**
 * Showdown Data Service
 * Fetches Pokemon data from the Showdown server for sprites, types, base stats, etc.
 */

const SHOWDOWN_DATA_BASE = 'https://play.pokemonshowdown.com/data';
let pokedexCache = null;
let movesCache = null;
let itemsCache = null;
let abilitiesCache = null;

/**
 * Fetch and cache the entire Pokedex
 */
export async function fetchPokedex() {
  if (pokedexCache) return pokedexCache;

  try {
    const response = await fetch(`${SHOWDOWN_DATA_BASE}/pokedex.json`);
    const data = await response.json();
    pokedexCache = data;
    return data;
  } catch (e) {
    console.error('Failed to fetch Pokedex:', e);
    return {};
  }
}

/**
 * Fetch and cache moves data
 */
export async function fetchMoves() {
  if (movesCache) return movesCache;

  try {
    const response = await fetch(`${SHOWDOWN_DATA_BASE}/moves.json`);
    const data = await response.json();
    movesCache = data;
    return data;
  } catch (e) {
    console.error('Failed to fetch moves:', e);
    return {};
  }
}

/**
 * Parse a Showdown .js data file that exports a variable like:
 * exports.BattleItems = { ... };
 *
 * Uses a line-by-line parser (no eval / new Function) so it works
 * under strict CSP and in every deployment environment.
 */
function parseShowdownJS(text) {
  const result = {};
  const lines = text.split('\n');
  let currentKey = null;
  let currentEntry = {};
  let braceDepth = 0;
  let inEntry = false;

  for (const line of lines) {
    // Detect a top-level entry start: single-tab indented key followed by {
    if (!inEntry) {
      const entryStart = line.match(/^\t(\w+):\s*\{/);
      if (entryStart) {
        currentKey = entryStart[1];
        currentEntry = {};
        braceDepth = 1;
        inEntry = true;
      }
      continue;
    }

    // Inside an entry — count braces to know when it ends
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
    }

    // Extract string properties at the second tab level
    const strProp = line.match(/^\t\t(\w+):\s*"([^"]*)"/);
    if (strProp) {
      currentEntry[strProp[1]] = strProp[2];
    }

    // Extract number properties at the second tab level
    const numProp = line.match(/^\t\t(\w+):\s*(-?\d+)/);
    if (numProp && !strProp) {
      currentEntry[numProp[1]] = Number(numProp[2]);
    }

    // Extract boolean/null at the second tab level
    const boolProp = line.match(/^\t\t(\w+):\s*(true|false|null)\b/);
    if (boolProp) {
      currentEntry[boolProp[1]] = boolProp[2] === 'true' ? true : boolProp[2] === 'false' ? false : null;
    }

    // Extract simple string arrays (e.g., types: ["Fire", "Flying"])
    const arrProp = line.match(/^\t\t(\w+):\s*\[([^\]]*)\]/);
    if (arrProp) {
      currentEntry[arrProp[1]] = arrProp[2]
        .split(',')
        .map(s => s.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    }

    if (braceDepth === 0) {
      // Entry complete
      if (currentKey) {
        result[currentKey] = currentEntry;
      }
      inEntry = false;
      currentKey = null;
    }
  }

  return result;
}

/**
 * Fetch and cache items data (.js format — .json is 404)
 */
export async function fetchItems() {
  if (itemsCache) return itemsCache;

  try {
    const response = await fetch(`${SHOWDOWN_DATA_BASE}/items.js`);
    const text = await response.text();
    const data = parseShowdownJS(text);
    itemsCache = data;
    return data;
  } catch (e) {
    console.error('Failed to fetch items:', e);
    return {};
  }
}

/**
 * Fetch and cache abilities data (.js format — .json is 404)
 */
export async function fetchAbilities() {
  if (abilitiesCache) return abilitiesCache;

  try {
    const response = await fetch(`${SHOWDOWN_DATA_BASE}/abilities.js`);
    const text = await response.text();
    const data = parseShowdownJS(text);
    abilitiesCache = data;
    return data;
  } catch (e) {
    console.error('Failed to fetch abilities:', e);
    return {};
  }
}

/**
 * Get Pokemon data from pokedex by name
 */
export async function getPokemonData(name) {
  const pokedex = await fetchPokedex();
  const id = toShowdownId(name);

  // Try exact ID match
  if (pokedex[id]) return { id, ...pokedex[id] };

  // Try finding by name
  for (const [key, data] of Object.entries(pokedex)) {
    if (data.name && data.name.toLowerCase() === name.toLowerCase()) {
      return { id: key, ...data };
    }
  }

  return null;
}

/**
 * Get Pokemon types from pokedex
 */
export async function getPokemonTypes(name) {
  const data = await getPokemonData(name);
  return data?.types || [];
}

/**
 * Get Pokemon base stats
 */
export async function getPokemonBaseStats(name) {
  const data = await getPokemonData(name);
  return data?.baseStats || null;
}

/**
 * Search Pokemon by partial name
 */
export async function searchPokemon(query, limit = 20) {
  const pokedex = await fetchPokedex();
  if (!query) return [];

  const q = query.toLowerCase();
  const results = [];

  for (const [id, data] of Object.entries(pokedex)) {
    if (!data.name || !data.num || data.num <= 0) continue;
    if (data.isNonstandard && data.isNonstandard !== 'Past') continue;

    const name = data.name.toLowerCase();
    if (name.startsWith(q) || name.includes(q) || id.includes(q)) {
      results.push({
        id,
        name: data.name,
        types: data.types || [],
        baseStats: data.baseStats || {},
        num: data.num,
      });
    }

    if (results.length >= limit * 3) break; // We'll sort and limit later
  }

  // Sort: prefer starts-with matches, then alphabetical
  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

/**
 * Search moves by partial name
 */
export async function searchMoves(query, limit = 20) {
  const moves = await fetchMoves();
  if (!query) return [];

  const q = query.toLowerCase();
  const results = [];

  for (const [id, data] of Object.entries(moves)) {
    if (!data.name || data.isZ || data.isMax) continue;
    const name = data.name.toLowerCase();
    if (name.startsWith(q) || name.includes(q) || id.includes(q)) {
      results.push({
        id,
        name: data.name,
        type: data.type || 'Normal',
        category: data.category || 'Status',
        basePower: data.basePower || 0,
        accuracy: data.accuracy === true ? '—' : data.accuracy,
        pp: data.pp || 0,
        desc: data.shortDesc || data.desc || '',
      });
    }

    if (results.length >= limit * 3) break;
  }

  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

/**
 * Search items by partial name
 */
export async function searchItems(query, limit = 20) {
  const items = await fetchItems();
  if (!query) return [];

  const q = query.toLowerCase();
  const results = [];

  for (const [id, data] of Object.entries(items)) {
    if (!data.name || data.isNonstandard) continue;
    const name = data.name.toLowerCase();
    if (name.startsWith(q) || name.includes(q) || id.includes(q)) {
      results.push({
        id,
        name: data.name,
        desc: data.shortDesc || data.desc || '',
      });
    }

    if (results.length >= limit * 3) break;
  }

  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

/**
 * Get all abilities for a Pokemon
 */
export async function getPokemonAbilities(name) {
  const data = await getPokemonData(name);
  if (!data?.abilities) return [];

  const abilities = [];
  if (data.abilities['0']) abilities.push(data.abilities['0']);
  if (data.abilities['1']) abilities.push(data.abilities['1']);
  if (data.abilities.H) abilities.push(data.abilities.H);
  if (data.abilities.S) abilities.push(data.abilities.S);

  return [...new Set(abilities)];
}

/**
 * Convert Pokemon name to Showdown ID format
 */
function toShowdownId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// ===== Name formatting: convert lowercase IDs (from chaos JSON) to proper display names =====

// Build reverse-lookup maps from Showdown data (id → proper name)
let moveNameMap = null;
let itemNameMap = null;
let abilityNameMap = null;
let nameMapsReady = false;

/**
 * Pre-load all name maps. Call this once at app startup.
 */
export async function preloadNameMaps() {
  if (nameMapsReady) return;
  const [moves, items, abilities] = await Promise.all([
    fetchMoves(),
    fetchItems(),
    fetchAbilities(),
  ]);
  moveNameMap = {};
  for (const [id, data] of Object.entries(moves)) {
    if (data.name) moveNameMap[id] = data.name;
  }
  itemNameMap = {};
  for (const [id, data] of Object.entries(items)) {
    if (data.name) itemNameMap[id] = data.name;
  }
  abilityNameMap = {};
  for (const [id, data] of Object.entries(abilities)) {
    if (data.name) abilityNameMap[id] = data.name;
  }
  nameMapsReady = true;
}

/**
 * Fallback: capitalize a lowercase ID into a display name
 * e.g. "rapidspin" → "Rapidspin" (not perfect, but better than lowercase)
 */
function fallbackCapitalize(id) {
  if (!id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Sync: Convert a move ID (from chaos JSON) to its proper display name
 */
export function formatMoveName(id) {
  if (!id) return '';
  return moveNameMap?.[id] || fallbackCapitalize(id);
}

/**
 * Sync: Convert an item ID (from chaos JSON) to its proper display name
 */
export function formatItemName(id) {
  if (!id) return '';
  return itemNameMap?.[id] || fallbackCapitalize(id);
}

/**
 * Sync: Convert an ability ID (from chaos JSON) to its proper display name
 */
export function formatAbilityName(id) {
  if (!id) return '';
  return abilityNameMap?.[id] || fallbackCapitalize(id);
}

/**
 * Convert a tera/type ID to proper display name (simple capitalize)
 */
export function formatTypeName(id) {
  if (!id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Get sprite URL for a Pokemon
 */
export function getSpriteUrl(name) {
  const id = toShowdownId(name);
  return `https://play.pokemonshowdown.com/sprites/dex/${id}.png`;
}

/**
 * Get animated sprite URL for a Pokemon
 */
export function getAnimatedSpriteUrl(name) {
  const id = toShowdownId(name);
  return `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`;
}

/**
 * Get a list of all Pokemon names (for autocomplete)
 */
export async function getAllPokemonNames() {
  const pokedex = await fetchPokedex();
  return Object.entries(pokedex)
    .filter(([, data]) => data.num > 0 && (!data.isNonstandard || data.isNonstandard === 'Past'))
    .map(([, data]) => data.name)
    .sort();
}
