import { createContext, useContext, useReducer, useState, useEffect, useCallback } from 'react';
import { DEFAULT_FORMAT, RATING_CUTOFFS, getAvailableMonths } from '../data/formats';
import { fetchAvailableRatings, preloadRatings, startIdlePreloader, stopIdlePreloader } from '../services/smogonApi';

const AppContext = createContext(null);

const STORAGE_KEY = 'smogon-teambuilder-settings';

function loadSettings() {
  const latestMonth = getAvailableMonths()[0]?.id || DEFAULT_FORMAT.month;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Always update to the most recent available month
      if (parsed.format) {
        parsed.format.month = latestMonth;
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return {
    format: { ...DEFAULT_FORMAT, month: latestMonth },
    aiApiKey: '',
    aiProvider: 'openai', // 'openai' or 'anthropic'
  };
}

function saveSettings(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

const initialState = loadSettings();

function appReducer(state, action) {
  let newState;

  switch (action.type) {
    case 'SET_FORMAT':
      newState = { ...state, format: { ...state.format, ...action.format } };
      break;

    case 'SET_GEN':
      newState = { ...state, format: { ...state.format, gen: action.gen } };
      break;

    case 'SET_TIER':
      newState = { ...state, format: { ...state.format, tier: action.tier } };
      break;

    case 'SET_MONTH':
      newState = { ...state, format: { ...state.format, month: action.month } };
      break;

    case 'SET_RATING':
      newState = { ...state, format: { ...state.format, rating: action.rating } };
      break;

    case 'SET_AI_KEY':
      newState = { ...state, aiApiKey: action.key };
      break;

    case 'SET_AI_PROVIDER':
      newState = { ...state, aiProvider: action.provider };
      break;

    default:
      return state;
  }

  saveSettings(newState);
  return newState;
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [availableRatings, setAvailableRatings] = useState(null); // null = loading/unknown, [] = none
  const [ratingsLoading, setRatingsLoading] = useState(false);

  const formatId = `gen${state.format.gen}${state.format.tier}`;

  // Fetch available ratings whenever format or month changes
  useEffect(() => {
    let cancelled = false;
    setRatingsLoading(true);

    fetchAvailableRatings(state.format.month, formatId).then(ratings => {
      if (cancelled) return;
      setAvailableRatings(ratings);
      setRatingsLoading(false);

      // Preload chaos data for all ratings in the background
      if (ratings && ratings.length > 0) {
        preloadRatings(state.format.month, formatId, ratings);
      }

      // Start idle preloader for other formats (runs during browser idle time)
      startIdlePreloader(
        state.format.month,
        state.format.gen,
        state.format.tier,
        state.format.rating
      );

      // If we got ratings back and the current rating isn't in the list, auto-correct
      if (ratings && ratings.length > 0 && !ratings.includes(state.format.rating)) {
        // Pick the highest available rating (most useful default)
        const best = ratings[ratings.length - 1];
        dispatch({ type: 'SET_RATING', rating: best });
      }
    }).catch(() => {
      if (!cancelled) {
        setAvailableRatings(null);
        setRatingsLoading(false);
      }
    });

    return () => { cancelled = true; stopIdlePreloader(); };
  }, [state.format.month, formatId]);

  // Compute the filtered rating cutoffs to pass down
  const filteredRatingCutoffs = availableRatings
    ? RATING_CUTOFFS.filter(r => availableRatings.includes(r.id))
    : RATING_CUTOFFS; // show all when unknown

  const value = {
    ...state,
    formatId,
    dispatch,
    availableRatings,
    ratingsLoading,
    filteredRatingCutoffs,

    // Convenience
    setFormat: (format) => dispatch({ type: 'SET_FORMAT', format }),
    setGen: (gen) => dispatch({ type: 'SET_GEN', gen }),
    setTier: (tier) => dispatch({ type: 'SET_TIER', tier }),
    setMonth: (month) => dispatch({ type: 'SET_MONTH', month }),
    setRating: (rating) => dispatch({ type: 'SET_RATING', rating }),
    setAiKey: (key) => dispatch({ type: 'SET_AI_KEY', key }),
    setAiProvider: (provider) => dispatch({ type: 'SET_AI_PROVIDER', provider }),
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

export default AppContext;
