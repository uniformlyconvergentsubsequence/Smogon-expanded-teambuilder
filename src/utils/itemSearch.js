/**
 * Item-based Pokemon search
 *
 * Uses chaos data to answer: "which Pokemon commonly run this item?"
 * All item keys in chaos data are Showdown IDs (lowercase, no spaces).
 */

/**
 * Get all item IDs present in the format, sorted by combined weighted frequency.
 * Returns raw Showdown IDs (e.g. "choicescarf") — convert with formatItemName() for display.
 *
 * @param {object} chaosData
 * @returns {string[]}
 */
export function getFormatItemList(chaosData) {
  if (!chaosData?.data) return [];

  const itemTotals = {};

  for (const pokemonData of Object.values(chaosData.data)) {
    const items = pokemonData.Items;
    if (!items) continue;
    for (const [itemId, count] of Object.entries(items)) {
      itemTotals[itemId] = (itemTotals[itemId] || 0) + count;
    }
  }

  return Object.entries(itemTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

/**
 * Find Pokemon that use a given item at or above the specified threshold.
 *
 * @param {object} chaosData
 * @param {string} itemId - Raw Showdown item ID (e.g. "choicescarf")
 * @param {number} threshold - Fraction 0–1 (default 0.10 = 10 %)
 * @returns {{ name: string, itemPct: number, usage: number }[]}
 *   Sorted by item usage descending.
 */
export function getItemUsers(chaosData, itemId, threshold = 0.10) {
  if (!chaosData?.data || !itemId) return [];

  const results = [];

  for (const [name, data] of Object.entries(chaosData.data)) {
    if (!data.Items) continue;

    const totalItems = Object.values(data.Items).reduce((s, v) => s + v, 0);
    if (!totalItems) continue;

    const matchCount = data.Items[itemId] ?? 0;
    if (!matchCount) continue;

    const itemPct = matchCount / totalItems;
    if (itemPct >= threshold) {
      results.push({
        name,
        itemPct: itemPct * 100,
        usage: data.usage || 0,
      });
    }
  }

  return results.sort((a, b) => b.itemPct - a.itemPct);
}
