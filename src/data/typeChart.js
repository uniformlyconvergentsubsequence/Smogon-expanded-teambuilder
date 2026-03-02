// Complete type effectiveness chart
// Usage: TYPE_CHART[attackingType][defendingType] = multiplier

export const TYPE_LIST = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

// Effectiveness multipliers: 0 = immune, 0.5 = resist, 1 = neutral, 2 = super effective
export const TYPE_CHART = {
  Normal:   { Normal: 1, Fire: 1, Water: 1, Electric: 1, Grass: 1, Ice: 1, Fighting: 1, Poison: 1, Ground: 1, Flying: 1, Psychic: 1, Bug: 1, Rock: 0.5, Ghost: 0, Dragon: 1, Dark: 1, Steel: 0.5, Fairy: 1 },
  Fire:     { Normal: 1, Fire: 0.5, Water: 0.5, Electric: 1, Grass: 2, Ice: 2, Fighting: 1, Poison: 1, Ground: 1, Flying: 1, Psychic: 1, Bug: 2, Rock: 0.5, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 2, Fairy: 1 },
  Water:    { Normal: 1, Fire: 2, Water: 0.5, Electric: 1, Grass: 0.5, Ice: 1, Fighting: 1, Poison: 1, Ground: 2, Flying: 1, Psychic: 1, Bug: 1, Rock: 2, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 1, Fairy: 1 },
  Electric: { Normal: 1, Fire: 1, Water: 2, Electric: 0.5, Grass: 0.5, Ice: 1, Fighting: 1, Poison: 1, Ground: 0, Flying: 2, Psychic: 1, Bug: 1, Rock: 1, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 1, Fairy: 1 },
  Grass:    { Normal: 1, Fire: 0.5, Water: 2, Electric: 1, Grass: 0.5, Ice: 1, Fighting: 1, Poison: 0.5, Ground: 2, Flying: 0.5, Psychic: 1, Bug: 0.5, Rock: 2, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 0.5, Fairy: 1 },
  Ice:      { Normal: 1, Fire: 0.5, Water: 0.5, Electric: 1, Grass: 2, Ice: 0.5, Fighting: 1, Poison: 1, Ground: 2, Flying: 2, Psychic: 1, Bug: 1, Rock: 1, Ghost: 1, Dragon: 2, Dark: 1, Steel: 0.5, Fairy: 1 },
  Fighting: { Normal: 2, Fire: 1, Water: 1, Electric: 1, Grass: 1, Ice: 2, Fighting: 1, Poison: 0.5, Ground: 1, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dragon: 1, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison:   { Normal: 1, Fire: 1, Water: 1, Electric: 1, Grass: 2, Ice: 1, Fighting: 1, Poison: 0.5, Ground: 0.5, Flying: 1, Psychic: 1, Bug: 1, Rock: 0.5, Ghost: 0.5, Dragon: 1, Dark: 1, Steel: 0, Fairy: 2 },
  Ground:   { Normal: 1, Fire: 2, Water: 1, Electric: 2, Grass: 0.5, Ice: 1, Fighting: 1, Poison: 2, Ground: 1, Flying: 0, Psychic: 1, Bug: 0.5, Rock: 2, Ghost: 1, Dragon: 1, Dark: 1, Steel: 2, Fairy: 1 },
  Flying:   { Normal: 1, Fire: 1, Water: 1, Electric: 0.5, Grass: 2, Ice: 1, Fighting: 2, Poison: 1, Ground: 1, Flying: 1, Psychic: 1, Bug: 2, Rock: 0.5, Ghost: 1, Dragon: 1, Dark: 1, Steel: 0.5, Fairy: 1 },
  Psychic:  { Normal: 1, Fire: 1, Water: 1, Electric: 1, Grass: 1, Ice: 1, Fighting: 2, Poison: 2, Ground: 1, Flying: 1, Psychic: 0.5, Bug: 1, Rock: 1, Ghost: 1, Dragon: 1, Dark: 0, Steel: 0.5, Fairy: 1 },
  Bug:      { Normal: 1, Fire: 0.5, Water: 1, Electric: 1, Grass: 2, Ice: 1, Fighting: 0.5, Poison: 0.5, Ground: 1, Flying: 0.5, Psychic: 2, Bug: 1, Rock: 1, Ghost: 0.5, Dragon: 1, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock:     { Normal: 1, Fire: 2, Water: 1, Electric: 1, Grass: 1, Ice: 2, Fighting: 0.5, Poison: 1, Ground: 0.5, Flying: 2, Psychic: 1, Bug: 2, Rock: 1, Ghost: 1, Dragon: 1, Dark: 1, Steel: 0.5, Fairy: 1 },
  Ghost:    { Normal: 0, Fire: 1, Water: 1, Electric: 1, Grass: 1, Ice: 1, Fighting: 1, Poison: 1, Ground: 1, Flying: 1, Psychic: 2, Bug: 1, Rock: 1, Ghost: 2, Dragon: 1, Dark: 0.5, Steel: 1, Fairy: 1 },
  Dragon:   { Normal: 1, Fire: 1, Water: 1, Electric: 1, Grass: 1, Ice: 1, Fighting: 1, Poison: 1, Ground: 1, Flying: 1, Psychic: 1, Bug: 1, Rock: 1, Ghost: 1, Dragon: 2, Dark: 1, Steel: 0.5, Fairy: 0 },
  Dark:     { Normal: 1, Fire: 1, Water: 1, Electric: 1, Grass: 1, Ice: 1, Fighting: 0.5, Poison: 1, Ground: 1, Flying: 1, Psychic: 2, Bug: 1, Rock: 1, Ghost: 2, Dragon: 1, Dark: 0.5, Steel: 0.5, Fairy: 0.5 },
  Steel:    { Normal: 1, Fire: 0.5, Water: 0.5, Electric: 0.5, Grass: 1, Ice: 2, Fighting: 1, Poison: 1, Ground: 1, Flying: 1, Psychic: 1, Bug: 1, Rock: 2, Ghost: 1, Dragon: 1, Dark: 1, Steel: 0.5, Fairy: 2 },
  Fairy:    { Normal: 1, Fire: 0.5, Water: 1, Electric: 1, Grass: 1, Ice: 1, Fighting: 2, Poison: 0.5, Ground: 1, Flying: 1, Psychic: 1, Bug: 1, Rock: 1, Ghost: 1, Dragon: 2, Dark: 2, Steel: 0.5, Fairy: 1 },
};

// Defensive type chart: given a defending type, what multiplier does each attacking type get?
export function getDefensiveMultiplier(attackingType, ...defendingTypes) {
  let multiplier = 1;
  for (const defType of defendingTypes) {
    if (defType && TYPE_CHART[attackingType] && TYPE_CHART[attackingType][defType] !== undefined) {
      multiplier *= TYPE_CHART[attackingType][defType];
    }
  }
  return multiplier;
}

// Get all weaknesses for a type combination
export function getTypeMatchups(types) {
  const matchups = {};
  for (const attackType of TYPE_LIST) {
    matchups[attackType] = getDefensiveMultiplier(attackType, ...types);
  }
  return matchups;
}

// Get weaknesses (2x and 4x)
export function getWeaknesses(types) {
  const matchups = getTypeMatchups(types);
  return {
    quad: TYPE_LIST.filter(t => matchups[t] >= 4),
    double: TYPE_LIST.filter(t => matchups[t] === 2),
    neutral: TYPE_LIST.filter(t => matchups[t] === 1),
    resist: TYPE_LIST.filter(t => matchups[t] === 0.5),
    quadResist: TYPE_LIST.filter(t => matchups[t] <= 0.25 && matchups[t] > 0),
    immune: TYPE_LIST.filter(t => matchups[t] === 0),
  };
}

// Type color map for styling
export const TYPE_COLORS = {
  Normal: { bg: '#A8A77A', text: '#fff' },
  Fire: { bg: '#EE8130', text: '#fff' },
  Water: { bg: '#6390F0', text: '#fff' },
  Electric: { bg: '#F7D02C', text: '#333' },
  Grass: { bg: '#7AC74C', text: '#fff' },
  Ice: { bg: '#96D9D6', text: '#333' },
  Fighting: { bg: '#C22E28', text: '#fff' },
  Poison: { bg: '#A33EA1', text: '#fff' },
  Ground: { bg: '#E2BF65', text: '#333' },
  Flying: { bg: '#A98FF3', text: '#fff' },
  Psychic: { bg: '#F95587', text: '#fff' },
  Bug: { bg: '#A6B91A', text: '#fff' },
  Rock: { bg: '#B6A136', text: '#fff' },
  Ghost: { bg: '#735797', text: '#fff' },
  Dragon: { bg: '#6F35FC', text: '#fff' },
  Dark: { bg: '#705746', text: '#fff' },
  Steel: { bg: '#B7B7CE', text: '#333' },
  Fairy: { bg: '#D685AD', text: '#fff' },
};

export default TYPE_CHART;
