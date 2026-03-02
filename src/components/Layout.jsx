import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <main className="pt-16 min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800/50 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              Smogon Expanded Teambuilder — Not affiliated with Smogon, Nintendo, or Game Freak.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.smogon.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Smogon
              </a>
              <a
                href="https://pokemonshowdown.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Showdown
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
