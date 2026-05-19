// hooks/useAppState.js
// ─────────────────────────────────────────────────────────────────────────────
// Global state via React Context + useReducer.
// Replaces what would be Zustand / React Query in a full Next.js app.
//
// Exports:
//   AppProvider   — wrap your app with this
//   useAppState   — read state anywhere
//   useAppDispatch — dispatch actions anywhere
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useReducer } from 'react';
// ── Initial state ──────────────────────────────────────────────────────────
const initialState = {
  providers: [],
  nextProviderId: 1,
  runs: [],
  nextRunId: 1,
};

// ── Reducer ────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    // Providers (list is loaded from GET /api/providers on ProvidersPage)
    case 'SET_PROVIDERS':
      return {
        ...state,
        providers: action.payload,
        nextProviderId:
          action.payload.length === 0
            ? 1
            : Math.max(...action.payload.map((p) => p.id)) + 1,
      };

    case 'ADD_PROVIDER':
      return {
        ...state,
        providers: [...state.providers, { id: state.nextProviderId, ...action.payload }],
        nextProviderId: state.nextProviderId + 1,
      };

    case 'EDIT_PROVIDER':
      return {
        ...state,
        providers: state.providers.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };

    case 'DELETE_PROVIDER':
      return {
        ...state,
        providers: state.providers.filter(p => p.id !== action.payload),
      };

    case 'SET_RUNS':
      return {
        ...state,
        runs: action.payload,
        nextRunId:
          action.payload.length === 0
            ? 1
            : Math.max(...action.payload.map((r) => r.id)) + 1,
      };

    // Benchmark runs
    case 'ADD_RUN':
      return {
        ...state,
        runs: [{ id: state.nextRunId, ...action.payload }, ...state.runs],
        nextRunId: state.nextRunId + 1,
      };

    // Update a run in-place (used for progress + completion)
    case 'UPDATE_RUN':
      return {
        ...state,
        runs: state.runs.map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      };

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────
const StateContext    = createContext(null);
const DispatchContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState()    { return useContext(StateContext); }
export function useAppDispatch() { return useContext(DispatchContext); }
