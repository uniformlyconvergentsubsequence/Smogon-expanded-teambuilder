/**
 * Smogon Stats API Service
 * Fetches and caches data from Smogon's stats server
 */

const SMOGON_STATS_BASE = 'https://www.smogon.com/stats';

// In development, Vite proxies /smogon-stats to Smogon's server, avoiding CORS.
// In production, we fall back to CORS proxies.
const isDev = import.meta.env.DEV;

const CORS_PROXIES = isDev
  ? ['']  // In dev, just use the proxy path (set below)
  : [
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
      'https://api.codetabs.com/v1/proxy?quest=',
    ];

const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const STORAGE_PREFIX = 'smogon-cache:';

/**
 * Try to read from sessionStorage
 */
function storageGet(key) {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch (e) { /* ignore parse / quota errors */ }
  return null;
}

/**
 * Write to sessionStorage (best-effort; silently drops if quota exceeded)
 */
function storageSet(key, data) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    // QuotaExceeded — evict oldest entries and retry once
    try {
      evictOldestStorageEntries(5);
      sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (_) { /* give up */ }
  }
}

/**
 * Remove the N oldest cache entries from sessionStorage
 */
function evictOldestStorageEntries(count) {
  const entries = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) {
      try {
        const { timestamp } = JSON.parse(sessionStorage.getItem(k));
        entries.push({ key: k, timestamp });
      } catch (_) {
        entries.push({ key: k, timestamp: 0 });
      }
    }
  }
  entries.sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i < Math.min(count, entries.length); i++) {
    sessionStorage.removeItem(entries[i].key);
  }
}

/**
 * Fetch with CORS proxy fallback
 */
async function fetchWithFallback(url) {
  // In dev mode, rewrite Smogon stats URLs to use the Vite proxy
  if (isDev && url.startsWith(SMOGON_STATS_BASE)) {
    const proxyUrl = url.replace(SMOGON_STATS_BASE, '/smogon-stats');
    try {
      const response = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok) return response;
    } catch (e) {
      console.warn('Dev proxy failed, trying direct:', e.message);
    }
  }

  for (const proxy of CORS_PROXIES) {
    try {
      const fullUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
      const response = await fetch(fullUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) return response;
    } catch (e) {
      continue;
    }
  }
  throw new Error(`Failed to fetch: ${url}`);
}

/**
 * Fetch with two-tier caching (memory → sessionStorage → network)
 */
async function cachedFetch(url, parser = 'text') {
  const cacheKey = url + ':' + parser;

  // L1: in-memory
  const memCached = cache.get(cacheKey);
  if (memCached && Date.now() - memCached.timestamp < CACHE_DURATION) {
    return memCached.data;
  }

  // L2: sessionStorage
  const stored = storageGet(cacheKey);
  if (stored !== null) {
    // Promote to L1
    cache.set(cacheKey, { data: stored, timestamp: Date.now() });
    return stored;
  }

  // L3: network
  const response = await fetchWithFallback(url);
  let data;

  if (parser === 'json') {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // Store in both layers
  cache.set(cacheKey, { data, timestamp: Date.now() });
  storageSet(cacheKey, data);
  return data;
}

/**
 * Build the stats URL
 */
function buildStatsUrl(month, subdir, format, rating) {
  const file = `${format}-${rating}`;
  if (!subdir) return `${SMOGON_STATS_BASE}/${month}/${file}.txt`;
  if (subdir === 'chaos') return `${SMOGON_STATS_BASE}/${month}/${subdir}/${file}.json`;
  return `${SMOGON_STATS_BASE}/${month}/${subdir}/${file}.txt`;
}

/**
 * Fetch the chaos (detailed JSON) data for a format
 * This is the richest data source with movesets, items, abilities, teammates, etc.
 */
export async function fetchChaosData(month, format, rating = '1695') {
  const url = buildStatsUrl(month, 'chaos', format, rating);
  return cachedFetch(url, 'json');
}

/**
 * Fetch usage stats (text format) and parse into structured data
 */
export async function fetchUsageStats(month, format, rating = '0') {
  const url = buildStatsUrl(month, '', format, rating);
  const text = await cachedFetch(url, 'text');
  return parseUsageStats(text);
}

/**
 * Fetch leads stats
 */
export async function fetchLeadsStats(month, format, rating = '0') {
  const url = buildStatsUrl(month, 'leads', format, rating);
  const text = await cachedFetch(url, 'text');
  return parseUsageStats(text); // Same format as usage
}

/**
 * Fetch metagame stats
 */
export async function fetchMetagameStats(month, format, rating = '1695') {
  const url = buildStatsUrl(month, 'metagame', format, rating);
  const text = await cachedFetch(url, 'text');
  return parseMetagameStats(text);
}

/**
 * Fetch moveset stats (text format)
 */
export async function fetchMovesetStats(month, format, rating = '1695') {
  const url = buildStatsUrl(month, 'moveset', format, rating);
  const text = await cachedFetch(url, 'text');
  return parseMovesetStats(text);
}

/**
 * Fetch monotype usage stats (text format — overall or per-type)
 */
export async function fetchMonotypeStats(month, format, rating = '0') {
  const url = buildStatsUrl(month, 'monotype', format, rating);
  const text = await cachedFetch(url, 'text');
  return parseUsageStats(text);
}

/**
 * Fetch monotype chaos data (per-type JSON).
 * E.g., format = 'gen9monotype-monosteel', fetched from monotype/chaos/ subdir.
 */
export async function fetchMonotypeChaosData(month, format, rating = '0') {
  const url = `${SMOGON_STATS_BASE}/${month}/monotype/chaos/${format}-${rating}.json`;
  return cachedFetch(url, 'json');
}

/**
 * Extract type usage percentages from the metagame playstyle data.
 * Returns an array of { type, name, usage } sorted by usage desc.
 */
export function extractMonotypeUsage(metagameData) {
  if (!metagameData || !metagameData.playstyles) return [];
  return metagameData.playstyles
    .filter(p => p.name.startsWith('mono') && p.name !== 'monotype')
    .map(p => {
      const rawType = p.name.replace(/^mono/, '');
      const name = rawType.charAt(0).toUpperCase() + rawType.slice(1);
      return { type: rawType, name, usage: p.usage };
    })
    .sort((a, b) => b.usage - a.usage);
}

// ====== Parsers ======

/**
 * Parse usage/leads text data into structured format
 */
function parseUsageStats(text) {
  const lines = text.split('\n');
  const pokemon = [];
  let totalBattles = 0;

  for (const line of lines) {
    // Look for total battles
    const battleMatch = line.match(/Total battles:\s*([\d,]+)/);
    if (battleMatch) {
      totalBattles = parseInt(battleMatch[1].replace(/,/g, ''), 10);
      continue;
    }

    // Parse Pokemon rows: | Rank | Name | Usage % | Raw | Raw % |
    const rowMatch = line.match(
      /\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([\d.]+)%\s*\|\s*([\d]+)\s*\|\s*([\d.]+)%\s*\|/
    );
    if (rowMatch) {
      pokemon.push({
        rank: parseInt(rowMatch[1], 10),
        name: rowMatch[2].trim(),
        usage: parseFloat(rowMatch[3]) / 100,  // Convert from percentage to 0-1 fraction
        rawCount: parseInt(rowMatch[4], 10),
        rawPercent: parseFloat(rowMatch[5]),
      });
    }
  }

  return { totalBattles, pokemon };
}

/**
 * Parse metagame stats
 */
function parseMetagameStats(text) {
  const lines = text.split('\n');
  const playstyles = [];
  const stalliness = { mean: 0, data: [] };
  let inStalliness = false;

  for (const line of lines) {
    if (line.includes('Stalliness')) {
      inStalliness = true;
      continue;
    }

    if (!inStalliness) {
      // Parse playstyle: | Name  | percent% |
      const match = line.match(/\s*(.+?)\s{2,}([\d.]+)%/);
      if (match) {
        playstyles.push({
          name: match[1].trim(),
          usage: parseFloat(match[2]),
        });
      }
    } else {
      // Parse stalliness mean
      const meanMatch = line.match(/Mean:\s*([-\d.]+)/);
      if (meanMatch) {
        stalliness.mean = parseFloat(meanMatch[1]);
      }
    }
  }

  return { playstyles, stalliness };
}

/**
 * Parse moveset stats (text format) into per-Pokemon data
 */
function parseMovesetStats(text) {
  const blocks = text.split(/\+-+\+/).filter(b => b.trim());
  const pokemon = {};
  let currentName = '';

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const lines = block.split('\n').map(l => l.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Check if this is a Pokemon name block
    if (lines.length === 1 && !lines[0].includes(':') && !lines[0].includes('%')) {
      currentName = lines[0].trim();
      if (!pokemon[currentName]) {
        pokemon[currentName] = {
          name: currentName,
          rawCount: 0,
          avgWeight: 0,
          viabilityCeiling: 0,
          abilities: {},
          items: {},
          spreads: {},
          moves: {},
          teammates: {},
          checksAndCounters: {},
          teraTypes: {},
        };
      }
      continue;
    }

    if (!currentName) continue;

    // Parse the data lines
    for (const line of lines) {
      const rawMatch = line.match(/Raw count:\s*(\d+)/);
      if (rawMatch) {
        pokemon[currentName].rawCount = parseInt(rawMatch[1], 10);
        continue;
      }

      const avgMatch = line.match(/Avg\. weight:\s*([\d.]+)/);
      if (avgMatch) {
        pokemon[currentName].avgWeight = parseFloat(avgMatch[1]);
        continue;
      }

      const viaMatch = line.match(/Viability Ceiling:\s*(\d+)/);
      if (viaMatch) {
        pokemon[currentName].viabilityCeiling = parseInt(viaMatch[1], 10);
        continue;
      }

      // Parse percentage lines: "Name  45.678%"
      const pctMatch = line.match(/^(.+?)\s+([\d.]+)%$/);
      if (pctMatch) {
        const name = pctMatch[1].trim();
        const value = parseFloat(pctMatch[2]);

        // Determine which section we're in based on context
        if (name.includes(':') && name.includes('/')) {
          // Spread: "Jolly:0/252/0/0/4/252"
          pokemon[currentName].spreads[name] = value;
        } else if (name.startsWith('+') || name.startsWith('-')) {
          // Teammate: "+12.345" format doesn't apply here, check later
          pokemon[currentName].teammates[name] = value;
        } else {
          // Could be ability, item, move, or tera type
          // We'll categorize based on context clues from the section header
        }
      }
    }
  }

  return pokemon;
}

/**
 * Get a specific Pokemon's data from the chaos JSON
 */
export function getPokemonFromChaos(chaosData, pokemonName) {
  if (!chaosData || !chaosData.data) return null;

  // Try exact match first
  if (chaosData.data[pokemonName]) return chaosData.data[pokemonName];

  // Try case-insensitive match
  const lowerName = pokemonName.toLowerCase();
  for (const [name, data] of Object.entries(chaosData.data)) {
    if (name.toLowerCase() === lowerName) return { ...data, _name: name };
  }

  // Try partial match
  for (const [name, data] of Object.entries(chaosData.data)) {
    if (name.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerName.replace(/[^a-z0-9]/g, '')) {
      return { ...data, _name: name };
    }
  }

  return null;
}

/**
 * Get sorted usage list from chaos data
 */
export function getUsageListFromChaos(chaosData) {
  if (!chaosData || !chaosData.data) return [];

  return Object.entries(chaosData.data)
    .map(([name, data]) => ({
      name,
      usage: data.usage || 0,
      rawCount: data['Raw count'] || 0,
      viabilityCeiling: data['Viability Ceiling'] || [],
    }))
    .sort((a, b) => b.usage - a.usage)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

/**
 * Fetch the list of available rating cutoffs for a format/month
 * by parsing the Smogon stats directory listing HTML.
 */
export async function fetchAvailableRatings(month, format) {
  const cacheKey = `ratings:${month}:${format}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const url = `${SMOGON_STATS_BASE}/${month}/`;
    const response = await fetchWithFallback(url);
    const html = await response.text();

    // The directory listing has links like gen9uu-0.txt, gen9uu-1500.txt, etc.
    const pattern = new RegExp(`${format}-(\\d+)\\.txt`, 'gi');
    const ratings = new Set();
    let match;
    while ((match = pattern.exec(html)) !== null) {
      ratings.add(match[1]);
    }

    const result = Array.from(ratings).sort((a, b) => Number(a) - Number(b));
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (e) {
    console.warn('Could not fetch available ratings:', e);
    return null; // null means unknown, show all
  }
}

/**
 * Clear the cache (both memory and sessionStorage)
 */
export function clearCache() {
  cache.clear();
  // Clear sessionStorage cache entries
  const keysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) keysToRemove.push(k);
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));
}

/**
 * Preload chaos data for all given ratings of a format/month in the background.
 * This makes switching ratings instant since the data is already cached.
 */
const preloadInFlight = new Set();

export function preloadRatings(month, format, ratings) {
  if (!ratings || !ratings.length) return;

  for (const rating of ratings) {
    const key = `${month}:${format}:${rating}`;
    if (preloadInFlight.has(key)) continue;
    preloadInFlight.add(key);

    // Fire-and-forget background fetch — errors are silently ignored
    fetchChaosData(month, format, rating).catch(() => {}).finally(() => {
      preloadInFlight.delete(key);
    });

    // Also preload usage text data
    fetchUsageStats(month, format, rating).catch(() => {});
  }
}

/**
 * Get cache info
 */
export function getCacheInfo() {
  return {
    size: cache.size,
    entries: Array.from(cache.keys()),
  };
}

// ====== Eager Format Preloader ======
// Immediately preloads the most popular format combos, then fills in the rest during idle.

const PRIORITY_TIERS = ['ou', 'uu', 'ru', 'nu', 'ubers', 'pu', 'doublesou', 'lc', 'monotype', 'zu'];
const SECONDARY_TIERS = ['nationaldex', 'vgc2026', 'vgc2025', 'anythinggoes',
  'balancedhackmons', 'nationaldexuu', 'cap', '1v1', 'doublesuu', 'doublesubers',
  'nationaldexru', 'nationaldexmonotype', 'nationaldexubers',
  'almostanyability', 'mixandmega', 'nfe', 'stabmons', 'godlygift',
  'battlestadiumsingles', 'battlestadiumsinglesregi'];

let preloaderRunning = false;
let preloaderAbort = false;

/**
 * Check whether a chaos URL is already cached (memory or sessionStorage).
 */
function isChaosUrlCached(month, format, rating) {
  const url = buildStatsUrl(month, 'chaos', format, rating);
  const cacheKey = url + ':json';
  const memCached = cache.get(cacheKey);
  if (memCached && Date.now() - memCached.timestamp < CACHE_DURATION) return true;
  if (storageGet(cacheKey) !== null) return true;
  return false;
}

/**
 * Fetch a batch of formats concurrently (up to `concurrency` at a time).
 * Resolves after all are done. Skips already-cached entries.
 */
async function fetchBatch(items, concurrency = 3) {
  let i = 0;
  const next = async () => {
    while (i < items.length && !preloaderAbort) {
      const idx = i++;
      const { month, format, rating } = items[idx];
      if (isChaosUrlCached(month, format, rating)) continue;
      try {
        await fetchChaosData(month, format, rating);
      } catch (_) { /* ignore */ }
      // Small yield so we don't block the main thread
      await new Promise(r => setTimeout(r, 50));
    }
  };
  const workers = Array.from({ length: concurrency }, () => next());
  await Promise.all(workers);
}

/**
 * Start preloading formats. Immediately fetches the most popular ones,
 * then moves on to less common formats.
 *
 * @param {string} month - Current month
 * @param {number} currentGen - Current generation number
 * @param {string} currentTier - Current tier ID
 * @param {string} defaultRating - Rating to preload (default: '1695')
 */
export function startIdlePreloader(month, currentGen, currentTier, defaultRating = '1695') {
  stopIdlePreloader();
  preloaderAbort = false;
  preloaderRunning = true;

  // Build priority queue
  const priority1 = []; // Same gen, popular tiers
  const priority2 = []; // Same tier, other gens
  const priority3 = []; // Other popular combos

  // Priority 1: Other popular tiers in the current gen
  for (const tier of PRIORITY_TIERS) {
    if (tier === currentTier) continue;
    priority1.push({ month, format: `gen${currentGen}${tier}`, rating: defaultRating });
  }

  // Priority 2: Same tier in other gens + OU in other gens
  for (let gen = 9; gen >= 1; gen--) {
    if (gen === currentGen) continue;
    priority2.push({ month, format: `gen${gen}${currentTier}`, rating: defaultRating });
    if (currentTier !== 'ou') {
      priority2.push({ month, format: `gen${gen}ou`, rating: defaultRating });
    }
  }

  // Priority 3: Secondary tiers in current gen + popular tiers in other gens
  for (const tier of SECONDARY_TIERS) {
    if (tier === currentTier) continue;
    priority3.push({ month, format: `gen${currentGen}${tier}`, rating: defaultRating });
  }
  for (let gen = 9; gen >= 1; gen--) {
    if (gen === currentGen) continue;
    for (const tier of PRIORITY_TIERS) {
      if (tier === currentTier || tier === 'ou') continue; // already in priority2
      priority3.push({ month, format: `gen${gen}${tier}`, rating: defaultRating });
    }
  }

  // Deduplicate each batch
  const dedup = (items) => {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.month}:${item.format}:${item.rating}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const p1 = dedup(priority1);
  const p2 = dedup(priority2);
  const p3 = dedup(priority3);

  // Run: priority 1 immediately (3 concurrent), then 2, then 3
  (async () => {
    await fetchBatch(p1, 3);
    if (preloaderAbort) return;
    await fetchBatch(p2, 2);
    if (preloaderAbort) return;
    await fetchBatch(p3, 2);
    preloaderRunning = false;
  })();
}

/**
 * Stop the preloader.
 */
export function stopIdlePreloader() {
  preloaderAbort = true;
  preloaderRunning = false;
}
