import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { TeamProvider } from './context/TeamContext';
import { AppProvider } from './context/AppContext';
import { preloadNameMaps } from './services/showdownData';
import './index.css';

// Pre-load Showdown name maps so we can format chaos JSON IDs synchronously
preloadNameMaps();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <TeamProvider>
          <App />
        </TeamProvider>
      </AppProvider>
    </HashRouter>
  </React.StrictMode>
);
