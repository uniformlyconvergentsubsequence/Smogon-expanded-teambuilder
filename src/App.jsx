import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

const Home = lazy(() => import('./pages/Home'));
const Explorer = lazy(() => import('./pages/Explorer'));
const PokemonDetail = lazy(() => import('./pages/PokemonDetail'));
const TeamBuilder = lazy(() => import('./pages/TeamBuilder'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));

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
