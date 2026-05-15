/**
 * Team Synergy Scoring
 *
 * Ranks candidate Pokemon by conditional synergy rather than raw popularity.
 *
 * Core metric — Lift:
 *   lift(candidate | member) = P(candidate | member) / P(candidate)
 *
 * A lift of 2.0 means the candidate appears twice as often alongside that
 * team member as pure chance would predict.  A lift of 0.8 means it's seen
 * less often than expected — not great synergy.
 *
 * We aggregate per-member lifts with their geometric mean so that a candidate
 * that pairs well with EVERY current member scores higher than one that pairs
 * extremely well with one member but poorly with the rest.
 *
 * Mode adjustments on top of the geometric mean:
 *   balanced – pure lift, default
 *   spicy    – amplify lift, penalise base popularity → surfaces rare gems
 *   safe     – temper lift with some base-popularity weight → reliable picks
 */

import { getPokemonFromChaos } from '../services/smogonApi';

// Laplace smoothing constant — prevents zero-probability issues
const ALPHA = 0.0005;

/**
 * Get the total weighted count for a Pokemon from its Abilities field.
 * Smogon chaos data stores weighted tallies in each subfield; the Abilities
 * sum is the best proxy for the Pokemon's total weighted appearances.
 */
function getWeightedCount(pokemonData) {
  if (!pokemonData?.Abilities) return 0;
  return Object.values(pokemonData.Abilities).reduce((s, v) => s + v, 0);
}

/**
 * Score a single candidate Pokemon against the current team members.
 *
 * @param {string} candidateName - Pokemon to evaluate
 * @param {{ species: string }[]} teamMembers - Current non-empty team slots
 * @param {object} chaosData - Raw chaos JSON from fetchChaosData()
 * @param {'balanced'|'spicy'|'safe'} mode
 * @returns {{
 *   score: number,
 *   baseUsagePct: number,
 *   geoMeanLift: number,
 *   confidence: 'high'|'medium'|'low'|'none',
 *   method: 'lift'|'fallback',
 *   liftDetails: { member: string, lift: number, pConditionalPct: number, hasData: boolean }[]
 * } | null}
 */
export function scoreCandidate(candidateName, teamMembers, chaosData, mode = 'balanced') {
  const candidateData = getPokemonFromChaos(chaosData, candidateName);
  if (!candidateData) return null;

  const baseUsage = candidateData.usage || 0;
  // Skip Pokemon with negligible usage to avoid noise
  if (baseUsage < 0.001) return null;

  const liftDetails = [];

  for (const member of teamMembers) {
    const memberData = getPokemonFromChaos(chaosData, member.species);
    if (!memberData) continue;

    const memberCount = getWeightedCount(memberData);
    if (!memberCount) continue;

    const rawCoOccurrence = memberData.Teammates?.[candidateName] ?? 0;

    // P(candidate | member) — Laplace smoothed
    const pConditional = (rawCoOccurrence + ALPHA) / (memberCount + ALPHA);

    // Lift: how much more likely is the candidate given this team member
    const lift = pConditional / Math.max(baseUsage, ALPHA);

    liftDetails.push({
      member: member.species,
      lift,
      pConditionalPct: pConditional * 100,
      rawCoOccurrence,
      memberCount,
      hasData: rawCoOccurrence > 0,
    });
  }

  if (liftDetails.length === 0) {
    // No team members matched chaos data — fall back to raw usage
    return {
      score: baseUsage,
      baseUsagePct: baseUsage * 100,
      geoMeanLift: 1,
      confidence: 'none',
      method: 'fallback',
      liftDetails: [],
    };
  }

  // Geometric mean of lifts (= exp of average log-lift)
  const avgLogLift =
    liftDetails.reduce((s, l) => s + Math.log(Math.max(l.lift, ALPHA)), 0) /
    liftDetails.length;
  const geoMeanLift = Math.exp(avgLogLift);

  // Mode-specific scoring
  let score;
  if (mode === 'spicy') {
    // Amplify synergy signal and penalise raw popularity
    // → rare but highly synergistic picks rise to the top
    score = Math.pow(geoMeanLift, 1.5) / Math.sqrt(baseUsage + ALPHA);
  } else if (mode === 'safe') {
    // Keep the lift signal but blend in a popularity bonus
    // → synergistic AND reliable picks
    score = geoMeanLift * Math.pow(baseUsage + ALPHA, 0.35);
  } else {
    // Balanced: pure geometric mean lift
    score = geoMeanLift;
  }

  const withData = liftDetails.filter(l => l.hasData);
  const confidence =
    withData.length === 0 ? 'low'
    : withData.length === liftDetails.length ? 'high'
    : 'medium';

  return {
    score,
    baseUsagePct: baseUsage * 100,
    geoMeanLift,
    confidence,
    method: 'lift',
    liftDetails: liftDetails.sort((a, b) => b.lift - a.lift),
  };
}

/**
 * Score all eligible Pokemon and return the top-N suggestions.
 *
 * @param {{ species: string }[]} teamMembers
 * @param {object} chaosData
 * @param {{ mode?: string, count?: number }} options
 * @returns {{ name: string, score: number, baseUsagePct: number, geoMeanLift: number,
 *             confidence: string, method: string, liftDetails: object[] }[]}
 */
export function getSuggestions(teamMembers, chaosData, { mode = 'balanced', count = 15 } = {}) {
  if (!chaosData?.data || teamMembers.length === 0) return [];

  const onTeam = new Set(teamMembers.map(m => m.species));
  const results = [];

  for (const name of Object.keys(chaosData.data)) {
    if (onTeam.has(name)) continue;
    const result = scoreCandidate(name, teamMembers, chaosData, mode);
    if (!result) continue;
    results.push({ name, ...result });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, count);
}
