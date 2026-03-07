import { createContext, useContext, useReducer, useEffect } from 'react';
import { createEmptyTeam } from '../utils/exportShowdown';
import { getAvailableMonths } from '../data/formats';

const TeamContext = createContext(null);

const STORAGE_KEY = 'smogon-teambuilder-teams';

function loadTeams() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      // Validate structure — ensure every team has a pokemon array
      if (data && Array.isArray(data.teams) && data.teams.length > 0) {
        data.teams = data.teams.map(t => ({
          ...t,
          name: t.name || 'Team',
          pokemon: Array.isArray(t.pokemon) ? t.pokemon : createEmptyTeam(),
        }));
        if (typeof data.currentTeamIndex !== 'number' ||
            data.currentTeamIndex < 0 ||
            data.currentTeamIndex >= data.teams.length) {
          data.currentTeamIndex = 0;
        }
        return data;
      }
    }
  } catch (e) {
    console.error('Failed to load teams:', e);
  }
  return {
    currentTeamIndex: 0,
    teams: [{ name: 'Team 1', pokemon: createEmptyTeam() }],
  };
}

function saveTeams(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save teams:', e);
  }
}

const initialState = loadTeams();

function teamReducer(state, action) {
  let newState;

  switch (action.type) {
    case 'SET_POKEMON': {
      const teams = [...state.teams];
      const team = { ...teams[state.currentTeamIndex] };
      const pokemon = [...team.pokemon];
      pokemon[action.slotIndex] = { ...pokemon[action.slotIndex], ...action.pokemon };
      team.pokemon = pokemon;
      teams[state.currentTeamIndex] = team;
      newState = { ...state, teams };
      break;
    }

    case 'CLEAR_SLOT': {
      const teams = [...state.teams];
      const team = { ...teams[state.currentTeamIndex] };
      const pokemon = [...team.pokemon];
      pokemon[action.slotIndex] = {
        species: '', nickname: '', item: '', ability: '', nature: '', teraType: '',
        level: 100, shiny: false, gender: '',
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ['', '', '', ''],
      };
      team.pokemon = pokemon;
      teams[state.currentTeamIndex] = team;
      newState = { ...state, teams };
      break;
    }

    case 'SET_TEAM': {
      const teams = [...state.teams];
      teams[state.currentTeamIndex] = { ...teams[state.currentTeamIndex], pokemon: action.pokemon };
      newState = { ...state, teams };
      break;
    }

    case 'SET_TEAM_NAME': {
      const teams = [...state.teams];
      teams[state.currentTeamIndex] = { ...teams[state.currentTeamIndex], name: action.name };
      newState = { ...state, teams };
      break;
    }

    case 'ADD_TEAM': {
      const newTeam = {
        name: action.name || `Team ${state.teams.length + 1}`,
        formatId: action.formatId || '',
        format: action.format || null,
        pokemon: createEmptyTeam(),
      };
      newState = {
        ...state,
        teams: [...state.teams, newTeam],
        currentTeamIndex: state.teams.length,
      };
      break;
    }

    case 'SET_TEAM_FORMAT': {
      const teams = [...state.teams];
      teams[state.currentTeamIndex] = {
        ...teams[state.currentTeamIndex],
        formatId: action.formatId,
        format: action.format || null,
      };
      newState = { ...state, teams };
      break;
    }

    case 'DELETE_TEAM': {
      if (state.teams.length <= 1) return state;
      const teams = state.teams.filter((_, i) => i !== action.index);
      const newIndex = Math.min(state.currentTeamIndex, teams.length - 1);
      newState = { ...state, teams, currentTeamIndex: newIndex };
      break;
    }

    case 'SELECT_TEAM': {
      newState = { ...state, currentTeamIndex: action.index };
      break;
    }

    case 'IMPORT_TEAM': {
      const teams = [...state.teams];
      teams[state.currentTeamIndex] = {
        ...teams[state.currentTeamIndex],
        pokemon: action.pokemon,
      };
      newState = { ...state, teams };
      break;
    }

    default:
      return state;
  }

  saveTeams(newState);
  return newState;
}

export function TeamProvider({ children }) {
  const [state, dispatch] = useReducer(teamReducer, initialState);

  const currentTeam = state.teams[state.currentTeamIndex] || { name: 'Team 1', pokemon: createEmptyTeam() };
  // Ensure pokemon is always an array
  if (!Array.isArray(currentTeam.pokemon)) {
    currentTeam.pokemon = createEmptyTeam();
  }

  const value = {
    teams: state.teams,
    currentTeamIndex: state.currentTeamIndex,
    currentTeam,
    dispatch,

    // Convenience methods
    setPokemon: (slotIndex, pokemon) =>
      dispatch({ type: 'SET_POKEMON', slotIndex, pokemon }),
    clearSlot: (slotIndex) =>
      dispatch({ type: 'CLEAR_SLOT', slotIndex }),
    setTeam: (pokemon) =>
      dispatch({ type: 'SET_TEAM', pokemon }),
    setTeamName: (name) =>
      dispatch({ type: 'SET_TEAM_NAME', name }),
    addTeam: (name, formatId, format) =>
      dispatch({ type: 'ADD_TEAM', name, formatId, format }),
    setTeamFormat: (formatId, format) =>
      dispatch({ type: 'SET_TEAM_FORMAT', formatId, format }),
    getTeamFormat: () => {
      const team = state.teams[state.currentTeamIndex];
      return team?.format || null;
    },
    deleteTeam: (index) =>
      dispatch({ type: 'DELETE_TEAM', index }),
    selectTeam: (index) =>
      dispatch({ type: 'SELECT_TEAM', index }),
    importTeam: (pokemon) =>
      dispatch({ type: 'IMPORT_TEAM', pokemon }),
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam must be used within TeamProvider');
  return context;
}

export default TeamContext;
