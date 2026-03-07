import { TYPE_CHART, TYPE_LIST, getTypeMatchups } from '../data/typeChart';

/**
 * Analyze a team's defensive type coverage
 * Each team member: { species, types: ['Type1', 'Type2'] }
 */
export function analyzeTeamDefense(teamMembers) {
  const analysis = {};

  for (const attackType of TYPE_LIST) {
    analysis[attackType] = {
      type: attackType,
      weak: [],       // Pokemon weak to this type
      neutral: [],    // Pokemon neutral to this type
      resist: [],     // Pokemon that resist this type
      immune: [],     // Pokemon immune to this type
      totalWeakCount: 0,
      totalResistCount: 0,
    };

    for (const member of teamMembers) {
      if (!member || !member.types || member.types.length === 0) continue;

      const matchups = getTypeMatchups(member.types);
      const mult = matchups[attackType];

      if (mult === 0) {
        analysis[attackType].immune.push(member);
        analysis[attackType].totalResistCount++;
      } else if (mult < 1) {
        analysis[attackType].resist.push(member);
        analysis[attackType].totalResistCount++;
      } else if (mult > 1) {
        analysis[attackType].weak.push(member);
        analysis[attackType].totalWeakCount++;
      } else {
        analysis[attackType].neutral.push(member);
      }
    }
  }

  return analysis;
}

/**
 * Get the team's overall defensive weaknesses (sorted by severity)
 */
export function getTeamWeaknesses(teamMembers) {
  const analysis = analyzeTeamDefense(teamMembers);

  return TYPE_LIST
    .map(type => ({
      type,
      weakCount: analysis[type].totalWeakCount,
      resistCount: analysis[type].totalResistCount,
      score: analysis[type].totalWeakCount - analysis[type].totalResistCount,
      weak: analysis[type].weak.map(m => m.species),
      resist: [...analysis[type].resist, ...analysis[type].immune].map(m => m.species),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Analyze offensive type coverage
 * Each team member: { species, moves: [{ type: 'Fire' }, ...] }
 */
export function analyzeTeamOffense(teamMembers) {
  const coverage = {};

  for (const defType of TYPE_LIST) {
    coverage[defType] = {
      superEffective: false,
      coveredBy: [],
    };
  }

  for (const member of teamMembers) {
    if (!member || !member.moveTypes) continue;

    for (const moveType of member.moveTypes) {
      if (!moveType || !TYPE_CHART[moveType]) continue;

      for (const defType of TYPE_LIST) {
        if (TYPE_CHART[moveType][defType] >= 2) {
          coverage[defType].superEffective = true;
          if (!coverage[defType].coveredBy.includes(member.species)) {
            coverage[defType].coveredBy.push(member.species);
          }
        }
      }
    }
  }

  return coverage;
}

/**
 * Get types not covered offensively by the team
 */
export function getUncoveredTypes(teamMembers) {
  const coverage = analyzeTeamOffense(teamMembers);
  return TYPE_LIST.filter(type => !coverage[type].superEffective);
}

/**
 * Generate a defensive type chart matrix for the team
 */
export function generateTypeMatrix(teamMembers) {
  const matrix = [];

  for (const attackType of TYPE_LIST) {
    const row = {
      attackType,
      matchups: [],
    };

    for (const member of teamMembers) {
      if (!member || !member.types || member.types.length === 0) {
        row.matchups.push({ multiplier: 1, species: member?.species || '' });
        continue;
      }

      const matchup = getTypeMatchups(member.types);
      row.matchups.push({
        multiplier: matchup[attackType],
        species: member.species,
      });
    }

    matrix.push(row);
  }

  return matrix;
}

/**
 * Suggest types that would complement the team defensively
 * @param {Array} teamMembers - The current team members
 * @param {string|null} monoType - If set, only suggest combos that include this type (for monotype formats)
 */
export function suggestDefensiveTypes(teamMembers, monoType = null) {
  const weaknesses = getTeamWeaknesses(teamMembers);
  const biggestWeaknesses = weaknesses
    .filter(w => w.score > 0)
    .slice(0, 5)
    .map(w => w.type);

  // Find types that resist the team's biggest weaknesses
  const suggestions = [];

  for (const type1 of TYPE_LIST) {
    for (const type2 of TYPE_LIST) {
      if (TYPE_LIST.indexOf(type1) > TYPE_LIST.indexOf(type2)) continue; // avoid duplicates

      const types = type1 === type2 ? [type1] : [type1, type2];

      // For monotype formats, only suggest combos that include the monotype type
      if (monoType && !types.some(t => t.toLowerCase() === monoType.toLowerCase())) continue;

      const matchups = getTypeMatchups(types);
      let score = 0;

      for (const weakness of biggestWeaknesses) {
        if (matchups[weakness] < 1) score += 2;
        if (matchups[weakness] === 0) score += 1;
      }

      if (score > 0) {
        suggestions.push({
          types,
          score,
          resistedWeaknesses: biggestWeaknesses.filter(w => matchups[w] < 1),
        });
      }
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/**
 * Calculate team synergy score (0-100)
 * Based on how well the team covers each other's weaknesses
 */
export function calculateSynergyScore(teamMembers) {
  if (teamMembers.length === 0) return 0;

  const analysis = analyzeTeamDefense(teamMembers);
  let totalScore = 0;
  let maxScore = TYPE_LIST.length;

  for (const type of TYPE_LIST) {
    const data = analysis[type];
    // Good: at least one resist/immune and not too many weak
    if (data.totalResistCount > 0 && data.totalWeakCount <= 2) {
      totalScore += 1;
    } else if (data.totalResistCount > 0) {
      totalScore += 0.5;
    } else if (data.totalWeakCount === 0) {
      totalScore += 0.7;
    }
  }

  return Math.round((totalScore / maxScore) * 100);
}
