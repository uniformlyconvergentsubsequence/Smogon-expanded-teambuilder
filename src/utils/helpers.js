// Utility helpers

/**
 * Convert a Pokemon name to a Showdown-compatible ID
 */
export function toShowdownId(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Convert a Showdown ID to a display-friendly name slug
 */
export function toSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

/**
 * Convert a slug back to a display name guess
 */
export function fromSlug(slug) {
  if (!slug) return '';
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format a percentage for display
 */
export function formatPercent(value, decimals = 2) {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format a raw percentage (already multiplied by 100)
 */
export function formatRawPercent(value, decimals = 2) {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return value.toFixed(decimals) + '%';
}

/**
 * Format a large number with commas
 */
export function formatNumber(num) {
  if (typeof num !== 'number') return '0';
  return num.toLocaleString('en-US');
}

/**
 * Debounce function
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Parse a Showdown spread string like "Jolly:0/252/0/0/4/252"
 */
export function parseSpread(spreadStr) {
  const [nature, evsStr] = spreadStr.split(':');
  if (!evsStr) return null;
  const evValues = evsStr.split('/').map(Number);
  return {
    nature,
    evs: {
      hp: evValues[0] || 0,
      atk: evValues[1] || 0,
      def: evValues[2] || 0,
      spa: evValues[3] || 0,
      spd: evValues[4] || 0,
      spe: evValues[5] || 0,
    },
  };
}

/**
 * Sort an object's entries by value (descending)
 */
export function sortByValue(obj) {
  return Object.entries(obj)
    .sort(([, a], [, b]) => b - a);
}

/**
 * Truncate a string
 */
export function truncate(str, len = 20) {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + '…';
}

/**
 * Classify effectiveness multiplier
 */
export function classifyEffectiveness(multiplier) {
  if (multiplier === 0) return 'immune';
  if (multiplier <= 0.25) return 'resist4';
  if (multiplier === 0.5) return 'resist';
  if (multiplier === 1) return 'neutral';
  if (multiplier === 2) return 'weak';
  if (multiplier >= 4) return 'weak4';
  return 'neutral';
}

/**
 * Get CSS class for effectiveness
 */
export function getEffectivenessClass(multiplier) {
  return 'eff-' + classifyEffectiveness(multiplier);
}

/**
 * Get display text for effectiveness
 */
export function getEffectivenessLabel(multiplier) {
  if (multiplier === 0) return '0×';
  if (multiplier === 0.25) return '¼×';
  if (multiplier === 0.5) return '½×';
  if (multiplier === 1) return '1×';
  if (multiplier === 2) return '2×';
  if (multiplier === 4) return '4×';
  return multiplier + '×';
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate a unique ID
 */
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
