import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

// Retry wrapper for lazy imports — handles stale chunks after redeployment
function lazyRetry(importFn) {
  return lazy(() =>
    importFn().catch(() => {
      // Chunk failed (likely stale hash after redeploy) — force reload once
      const reloaded = sessionStorage.getItem('chunk-reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
        return new Promise(() => {}); // never resolves — page is reloading
      }
      sessionStorage.removeItem('chunk-reload');
      return importFn(); // retry once more, then let it fail naturally
    })
  );
}

const Home = lazyRetry(() => import('./pages/Home'));
const Explorer = lazyRetry(() => import('./pages/Explorer'));
const PokemonDetail = lazyRetry(() => import('./pages/PokemonDetail'));
const TeamBuilder = lazyRetry(() => import('./pages/TeamBuilder'));
const AIAssistant = lazyRetry(() => import('./pages/AIAssistant'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="stats" element={<Explorer />} />
          <Route path="stats/:pokemon" element={<PokemonDetail />} />
          <Route path="builder" element={<TeamBuilder />} />
          <Route path="assistant" element={<AIAssistant />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
