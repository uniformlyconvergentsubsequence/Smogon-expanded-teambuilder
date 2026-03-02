import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { TeamProvider } from './context/TeamContext';
import { AppProvider } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import { preloadNameMaps } from './services/showdownData';
import './index.css';

// Pre-load Showdown name maps so we can format chaos JSON IDs synchronously
preloadNameMaps().catch((err) => {
  console.warn('preloadNameMaps failed (non-fatal):', err);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <AppProvider>
          <TeamProvider>
            <App />
          </TeamProvider>
        </AppProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
