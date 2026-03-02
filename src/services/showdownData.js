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
 * Fetch and cache items data
 */
export async function fetchItems() {
  if (itemsCache) return itemsCache;

  try {
    const response = await fetch(`${SHOWDOWN_DATA_BASE}/items.json`);
    const data = await response.json();
    itemsCache = data;
    return data;
  } catch (e) {
    console.error('Failed to fetch items:', e);
    return {};
  }
}

/**
 * Fetch and cache abilities data
 */
export async function fetchAbilities() {
  if (abilitiesCache) return abilitiesCache;

  try {
    const response = await fetch(`${SHOWDOWN_DATA_BASE}/abilities.json`);
    const data = await response.json();
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
