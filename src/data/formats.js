export const GENERATIONS = [
  { id: 9, name: 'Gen 9 (Scarlet & Violet)', prefix: 'gen9', dex: 'sv', short: 'Gen 9' },
  { id: 8, name: 'Gen 8 (Sword & Shield)', prefix: 'gen8', dex: 'ss', short: 'Gen 8' },
  { id: 7, name: 'Gen 7 (Sun & Moon)', prefix: 'gen7', dex: 'sm', short: 'Gen 7' },
  { id: 6, name: 'Gen 6 (X & Y)', prefix: 'gen6', dex: 'xy', short: 'Gen 6' },
  { id: 5, name: 'Gen 5 (Black & White)', prefix: 'gen5', dex: 'bw', short: 'Gen 5' },
  { id: 4, name: 'Gen 4 (Diamond & Pearl)', prefix: 'gen4', dex: 'dp', short: 'Gen 4' },
  { id: 3, name: 'Gen 3 (Ruby & Sapphire)', prefix: 'gen3', dex: 'rs', short: 'Gen 3' },
  { id: 2, name: 'Gen 2 (Gold & Silver)', prefix: 'gen2', dex: 'gs', short: 'Gen 2' },
  { id: 1, name: 'Gen 1 (Red & Blue)', prefix: 'gen1', dex: 'rb', short: 'Gen 1' },
];

export const TIERS = [
  { id: 'ou', name: 'OU', description: 'OverUsed' },
  { id: 'uu', name: 'UU', description: 'UnderUsed' },
  { id: 'ru', name: 'RU', description: 'RarelyUsed' },
  { id: 'nu', name: 'NU', description: 'NeverUsed' },
  { id: 'pu', name: 'PU', description: 'PU' },
  { id: 'zu', name: 'ZU', description: 'ZeroUsed' },
  { id: 'ubers', name: 'Ubers', description: 'Ubers' },
  { id: 'lc', name: 'LC', description: 'Little Cup' },
  { id: 'doublesou', name: 'Doubles OU', description: 'Doubles OverUsed' },
  { id: 'doublesuu', name: 'Doubles UU', description: 'Doubles UnderUsed' },
  { id: 'doublesubers', name: 'Doubles Ubers', description: 'Doubles Ubers' },
  { id: 'vgc2026', name: 'VGC 2026', description: 'Video Game Championships 2026' },
  { id: 'vgc2025', name: 'VGC 2025', description: 'Video Game Championships 2025' },
  { id: 'monotype', name: 'Monotype', description: 'Monotype' },
  { id: 'nationaldex', name: 'National Dex', description: 'National Dex' },
  { id: 'nationaldexuu', name: 'National Dex UU', description: 'National Dex UU' },
  { id: 'nationaldexru', name: 'National Dex RU', description: 'National Dex RU' },
  { id: 'nationaldexmonotype', name: 'National Dex Monotype', description: 'National Dex Monotype' },
  { id: 'nationaldexubers', name: 'National Dex Ubers', description: 'National Dex Ubers' },
  { id: 'cap', name: 'CAP', description: 'Create-A-Pokémon' },
  { id: '1v1', name: '1v1', description: '1v1' },
  { id: 'almostanyability', name: 'Almost Any Ability', description: 'Almost Any Ability' },
  { id: 'balancedhackmons', name: 'Balanced Hackmons', description: 'Balanced Hackmons' },
  { id: 'mixandmega', name: 'Mix and Mega', description: 'Mix and Mega' },
  { id: 'battlestadiumsingles', name: 'BSS', description: 'Battle Stadium Singles' },
  { id: 'battlestadiumsinglesreg' + 'i', name: 'BSS Reg I', description: 'Battle Stadium Singles Regulation I' },
  { id: 'anythinggoes', name: 'AG', description: 'Anything Goes' },
  { id: 'godlygift', name: 'Godly Gift', description: 'Godly Gift' },
  { id: 'stabmons', name: 'STABmons', description: 'STABmons' },
  { id: 'nfe', name: 'NFE', description: 'Not Fully Evolved' },
];

export const RATING_CUTOFFS = [
  { id: '0', name: 'All Ratings', description: 'No rating filter' },
  { id: '1500', name: '1500+', description: 'Rating ≥ 1500' },
  { id: '1630', name: '1630+', description: 'Rating ≥ 1630' },
  { id: '1695', name: '1695+', description: 'Rating ≥ 1695' },
  { id: '1760', name: '1760+', description: 'Rating ≥ 1760' },
  { id: '1825', name: '1825+', description: 'Rating ≥ 1825' },
];

export const STAT_CATEGORIES = [
  { id: 'usage', name: 'Usage', path: '', description: 'Overall usage rankings' },
  { id: 'moveset', name: 'Movesets', path: 'moveset', description: 'Detailed moveset analysis' },
  { id: 'leads', name: 'Leads', path: 'leads', description: 'Lead usage statistics' },
  { id: 'metagame', name: 'Metagame', path: 'metagame', description: 'Metagame composition' },
  { id: 'chaos', name: 'Detailed (JSON)', path: 'chaos', description: 'Full detailed data' },
];

// Generate available months dynamically
export function getAvailableMonths() {
  return [
    { id: '2026-02', name: 'February 2026' },
    { id: '2026-01', name: 'January 2026' },
  ];
}

export const NATURES = [
  { name: 'Adamant', plus: 'atk', minus: 'spa' },
  { name: 'Bold', plus: 'def', minus: 'atk' },
  { name: 'Brave', plus: 'atk', minus: 'spe' },
  { name: 'Calm', plus: 'spd', minus: 'atk' },
  { name: 'Careful', plus: 'spd', minus: 'spa' },
  { name: 'Gentle', plus: 'spd', minus: 'def' },
  { name: 'Hardy', plus: null, minus: null },
  { name: 'Hasty', plus: 'spe', minus: 'def' },
  { name: 'Impish', plus: 'def', minus: 'spa' },
  { name: 'Jolly', plus: 'spe', minus: 'spa' },
  { name: 'Lax', plus: 'def', minus: 'spd' },
  { name: 'Lonely', plus: 'atk', minus: 'def' },
  { name: 'Mild', plus: 'spa', minus: 'def' },
  { name: 'Modest', plus: 'spa', minus: 'atk' },
  { name: 'Naive', plus: 'spe', minus: 'spd' },
  { name: 'Naughty', plus: 'atk', minus: 'spd' },
  { name: 'Quiet', plus: 'spa', minus: 'spe' },
  { name: 'Quirky', plus: null, minus: null },
  { name: 'Rash', plus: 'spa', minus: 'spd' },
  { name: 'Relaxed', plus: 'def', minus: 'spe' },
  { name: 'Sassy', plus: 'spd', minus: 'spe' },
  { name: 'Serious', plus: null, minus: null },
  { name: 'Timid', plus: 'spe', minus: 'atk' },
  { name: 'Bashful', plus: null, minus: null },
  { name: 'Docile', plus: null, minus: null },
];

export const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

/**
 * Monotype formats that have per-type data in the monotype/ subdirectory.
 * Only gen9monotype has per-type chaos/usage data on Smogon.
 * nationaldexmonotype does NOT have per-type breakdowns.
 */
export const MONOTYPE_FORMATS_WITH_TYPE_DATA = ['monotype'];

/**
 * All formats that are "monotype-like" (where type selection is relevant).
 */
export const MONOTYPE_TIERS = ['monotype', 'nationaldexmonotype'];

/**
 * Check if a format ID is a monotype format.
 */
export function isMonotypeFormat(formatId) {
  return MONOTYPE_TIERS.some(t => formatId.includes(t));
}

/**
 * Check if a format ID has per-type data available in the monotype/ subdirectory.
 */
export function hasMonotypeTypeData(formatId) {
  // Only gen9monotype (not nationaldexmonotype) has per-type data
  return MONOTYPE_FORMATS_WITH_TYPE_DATA.some(t => {
    return formatId.endsWith(t) && !formatId.includes('nationaldex');
  });
}

/**
 * Get the monotype-typed format string (e.g., "gen9monotype" + "Steel" → "gen9monotype-monosteel")
 */
export function getMonotypeFormatId(formatId, type) {
  if (!type) return formatId;
  return `${formatId}-mono${type.toLowerCase()}`;
}

export function getFormatId(gen, tier) {
  return `gen${gen}${tier}`;
}

/**
 * Parse a formatId string (e.g. "gen9monotype") back into { gen, tier }.
 * Returns null if the formatId doesn't match the expected pattern.
 */
export function parseFormatId(formatId) {
  if (!formatId) return null;
  const match = formatId.match(/^gen(\d+)(.+)$/);
  if (!match) return null;
  const gen = parseInt(match[1], 10);
  const tier = match[2];
  // Validate the tier exists
  if (!TIERS.find(t => t.id === tier)) return null;
  return { gen, tier };
}

// Map our internal tier IDs to Smogon dex URL slugs
const DEX_TIER_SLUGS = {
  ou: 'ou',
  uu: 'uu',
  ru: 'ru',
  nu: 'nu',
  pu: 'pu',
  zu: 'zu',
  ubers: 'ubers',
  lc: 'lc',
  doublesou: 'doubles',
  doublesuu: 'doubles',
  doublesubers: 'doubles',
  monotype: 'monotype',
  nationaldex: 'national-dex',
  nationaldexuu: 'national-dex',
  nationaldexru: 'national-dex',
  nationaldexmonotype: 'national-dex-monotype',
  nationaldexubers: 'national-dex',
  cap: 'cap',
  '1v1': '1v1',
  almostanyability: 'almost-any-ability',
  balancedhackmons: 'balanced-hackmons',
  mixandmega: 'mix-and-mega',
  battlestadiumsingles: 'battle-stadium-singles',
  anythinggoes: 'ag',
  godlygift: 'godly-gift',
  stabmons: 'stabmons',
  nfe: 'nfe',
};

export function getSmogonDexUrl(pokemon, gen = 9, tier = '') {
  const genMap = { 1: 'rb', 2: 'gs', 3: 'rs', 4: 'dp', 5: 'bw', 6: 'xy', 7: 'sm', 8: 'ss', 9: 'sv' };
  const slug = pokemon.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
  const genSlug = genMap[gen] || 'sv';
  // Strip gen prefix from tier (e.g. "gen9monotype" -> "monotype")
  const tierKey = tier.replace(/^gen\d+/, '');
  const dexTier = DEX_TIER_SLUGS[tierKey];
  if (dexTier && dexTier !== 'ou') {
    return `https://www.smogon.com/dex/${genSlug}/pokemon/${slug}/${dexTier}/`;
  }
  return `https://www.smogon.com/dex/${genSlug}/pokemon/${slug}/`;
}

export function getStatsUrl(month, category, format, rating) {
  const base = `https://www.smogon.com/stats/${month}`;
  const file = `${format}-${rating}`;

  if (category === 'chaos') return `${base}/chaos/${file}.json`;
  if (category === 'usage' || category === '') return `${base}/${file}.txt`;
  return `${base}/${category}/${file}.txt`;
}

export function getSpriteUrl(pokemon) {
  const id = pokemon
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/\s+/g, '');
  return `https://play.pokemonshowdown.com/sprites/dex/${id}.png`;
}

export function getAnimatedSpriteUrl(pokemon) {
  const id = pokemon
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/\s+/g, '');
  return `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`;
}

// Default settings for the app
export const DEFAULT_FORMAT = {
  gen: 9,
  tier: 'ou',
  month: getAvailableMonths()[0].id,
  rating: '1695',
};
