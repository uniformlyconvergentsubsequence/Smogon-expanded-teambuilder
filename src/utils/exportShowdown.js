/**
 * Export a team to Pokemon Showdown paste format
 */
export function exportTeamToShowdown(team) {
  return team
    .filter(slot => slot && slot.species)
    .map(exportPokemonToShowdown)
    .join('\n\n');
}

/**
 * Export a single Pokemon to Showdown format
 */
function exportPokemonToShowdown(pokemon) {
  const lines = [];

  // Line 1: Name (Nickname) @ Item  OR  Name @ Item
  let line1 = '';
  if (pokemon.nickname) {
    line1 = `${pokemon.nickname} (${pokemon.species})`;
  } else {
    line1 = pokemon.species;
  }
  if (pokemon.gender === 'M') line1 += ' (M)';
  if (pokemon.gender === 'F') line1 += ' (F)';
  if (pokemon.item) line1 += ` @ ${pokemon.item}`;
  lines.push(line1);

  // Ability
  if (pokemon.ability) {
    lines.push(`Ability: ${pokemon.ability}`);
  }

  // Level (if not 100)
  if (pokemon.level && pokemon.level !== 100) {
    lines.push(`Level: ${pokemon.level}`);
  }

  // Shiny
  if (pokemon.shiny) {
    lines.push('Shiny: Yes');
  }

  // Tera Type
  if (pokemon.teraType) {
    lines.push(`Tera Type: ${pokemon.teraType}`);
  }

  // EVs
  const evParts = [];
  const evNames = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
  if (pokemon.evs) {
    for (const [stat, label] of Object.entries(evNames)) {
      if (pokemon.evs[stat] > 0) {
        evParts.push(`${pokemon.evs[stat]} ${label}`);
      }
    }
  }
  if (evParts.length > 0) {
    lines.push(`EVs: ${evParts.join(' / ')}`);
  }

  // Nature
  if (pokemon.nature) {
    lines.push(`${pokemon.nature} Nature`);
  }

  // IVs (only if not all 31)
  const ivParts = [];
  const ivNames = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
  if (pokemon.ivs) {
    for (const [stat, label] of Object.entries(ivNames)) {
      if (pokemon.ivs[stat] !== undefined && pokemon.ivs[stat] !== 31) {
        ivParts.push(`${pokemon.ivs[stat]} ${label}`);
      }
    }
  }
  if (ivParts.length > 0) {
    lines.push(`IVs: ${ivParts.join(' / ')}`);
  }

  // Moves
  if (pokemon.moves) {
    for (const move of pokemon.moves) {
      if (move) {
        lines.push(`- ${move}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Import a team from Showdown paste format
 */
export function importTeamFromShowdown(text) {
  if (!text || !text.trim()) return [];

  const blocks = text.trim().split(/\n\s*\n/);
  return blocks.map(parseShowdownPokemon).filter(Boolean);
}

/**
 * Parse a single Pokemon from Showdown format
 */
function parseShowdownPokemon(block) {
  const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const pokemon = {
    species: '',
    nickname: '',
    item: '',
    ability: '',
    nature: '',
    teraType: '',
    level: 100,
    shiny: false,
    gender: '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: [],
  };

  // Parse line 1: species/nickname @ item
  const firstLine = lines[0];
  let namePart = firstLine;
  let itemPart = '';

  if (firstLine.includes(' @ ')) {
    const atIdx = firstLine.lastIndexOf(' @ ');
    namePart = firstLine.slice(0, atIdx);
    itemPart = firstLine.slice(atIdx + 3);
  }

  // Check for gender
  const genderMatch = namePart.match(/\s*\((M|F)\)\s*$/);
  if (genderMatch) {
    pokemon.gender = genderMatch[1];
    namePart = namePart.slice(0, genderMatch.index);
  }

  // Check for nickname (species)
  const nickMatch = namePart.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (nickMatch) {
    pokemon.nickname = nickMatch[1].trim();
    pokemon.species = nickMatch[2].trim();
  } else {
    pokemon.species = namePart.trim();
  }

  pokemon.item = itemPart.trim();

  // Parse remaining lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('Ability:')) {
      pokemon.ability = line.slice(8).trim();
    } else if (line.startsWith('Level:')) {
      pokemon.level = parseInt(line.slice(6).trim(), 10) || 100;
    } else if (line.startsWith('Shiny:')) {
      pokemon.shiny = line.slice(6).trim().toLowerCase() === 'yes';
    } else if (line.startsWith('Tera Type:')) {
      pokemon.teraType = line.slice(10).trim();
    } else if (line.startsWith('EVs:')) {
      pokemon.evs = parseStatLine(line.slice(4));
    } else if (line.startsWith('IVs:')) {
      pokemon.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...parseStatLine(line.slice(4)) };
    } else if (line.endsWith(' Nature')) {
      pokemon.nature = line.slice(0, -7).trim();
    } else if (line.startsWith('- ')) {
      pokemon.moves.push(line.slice(2).trim());
    }
  }

  return pokemon;
}

/**
 * Parse a stat line like "252 Atk / 4 SpD / 252 Spe"
 */
function parseStatLine(str) {
  const stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const statMap = { HP: 'hp', Atk: 'atk', Def: 'def', SpA: 'spa', SpD: 'spd', Spe: 'spe' };

  const parts = str.split('/').map(s => s.trim());
  for (const part of parts) {
    const match = part.match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const key = statMap[match[2]] || match[2].toLowerCase();
      if (key in stats) stats[key] = value;
    }
  }

  return stats;
}

/**
 * Create an empty Pokemon slot
 */
export function createEmptyPokemon() {
  return {
    species: '',
    nickname: '',
    item: '',
    ability: '',
    nature: '',
    teraType: '',
    level: 100,
    shiny: false,
    gender: '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['', '', '', ''],
  };
}

/**
 * Create an empty team
 */
export function createEmptyTeam() {
  return Array.from({ length: 6 }, () => createEmptyPokemon());
}
