import { Link } from 'react-router-dom';
import { GENERATIONS, TIERS } from '../data/formats';
import { TYPE_COLORS } from '../data/typeChart';

const QUICK_FORMATS = [
  { gen: 9, tier: 'ou', label: 'Gen 9 OU', color: 'from-blue-500 to-blue-700' },
  { gen: 9, tier: 'uu', label: 'Gen 9 UU', color: 'from-violet-500 to-violet-700' },
  { gen: 9, tier: 'ubers', label: 'Gen 9 Ubers', color: 'from-red-500 to-red-700' },
  { gen: 9, tier: 'doublesou', label: 'Doubles OU', color: 'from-emerald-500 to-emerald-700' },
  { gen: 9, tier: 'ru', label: 'Gen 9 RU', color: 'from-amber-500 to-amber-700' },
  { gen: 9, tier: 'monotype', label: 'Monotype', color: 'from-pink-500 to-pink-700' },
  { gen: 9, tier: 'nationaldex', label: 'National Dex', color: 'from-cyan-500 to-cyan-700' },
  { gen: 9, tier: 'lc', label: 'Little Cup', color: 'from-orange-500 to-orange-700' },
];

const FEATURES = [
  {
    icon: ChartIcon,
    title: 'Stats Explorer',
    description: 'Browse usage statistics, movesets, leads, and metagame data for any format and time period.',
    link: '/stats',
    linkLabel: 'Explore Stats',
  },
  {
    icon: BuildIcon,
    title: 'Team Builder',
    description: 'Build competitive teams with full EV/IV/move editing. Import and export to Pokémon Showdown.',
    link: '/builder',
    linkLabel: 'Build a Team',
  },
  {
    icon: BrainIcon,
    title: 'AI Assistant',
    description: 'Analyze team weaknesses, check type coverage, and get AI-powered suggestions for your team.',
    link: '/assistant',
    linkLabel: 'Get Help',
  },
];

export default function Home() {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
              <span className="text-white">Smogon</span>{' '}
              <span className="text-gradient">Expanded</span>{' '}
              <span className="text-white">Teambuilder</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-400 leading-relaxed">
              Build competitive Pokémon teams with real-time usage statistics, moveset analysis,
              and AI-powered insights. Explore every format, every tier.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/builder" className="btn-primary text-lg px-8 py-3 shadow-lg shadow-blue-500/20">
                Start Building
              </Link>
              <Link to="/stats" className="btn-secondary text-lg px-8 py-3">
                Explore Stats
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Format Links */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-bold text-white mb-6">Popular Formats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_FORMATS.map(({ gen, tier, label, color }) => (
            <Link
              key={`${gen}${tier}`}
              to={`/stats?gen=${gen}&tier=${tier}`}
              className={`relative group overflow-hidden rounded-xl p-4 bg-gradient-to-br ${color}
                         shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}
            >
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
              <div className="relative">
                <p className="font-bold text-white text-sm sm:text-base">{label}</p>
                <p className="text-white/60 text-xs mt-1 font-mono">gen{gen}{tier}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="text-xl font-bold text-white mb-6">Features</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, description, link, linkLabel }) => (
            <div key={title} className="glass-panel p-6 group card-hover">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-4
                            group-hover:bg-blue-600/20 transition-colors">
                <Icon className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 mb-4 leading-relaxed">{description}</p>
              <Link to={link} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                {linkLabel} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Data Sources */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white mb-4">Data Sources & Stats Available</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard
              title="Usage Rankings"
              description="See which Pokémon are most popular in each tier, with raw usage numbers and weighted percentages."
              icon="📊"
            />
            <InfoCard
              title="Moveset Analysis"
              description="Detailed breakdowns of abilities, items, EV spreads, moves, Tera types, teammates, and counters."
              icon="🎯"
            />
            <InfoCard
              title="Leads Statistics"
              description="Discover the most common lead Pokémon in each format and plan your openings."
              icon="🏁"
            />
            <InfoCard
              title="Metagame Breakdown"
              description="Explore playstyle distribution (stall, balance, offense) and metagame trends."
              icon="🔬"
            />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-500">
              Stats sourced from{' '}
              <a href="https://www.smogon.com/stats/" target="_blank" rel="noopener noreferrer"
                 className="text-blue-400 hover:text-blue-300">
                Smogon Usage Statistics
              </a>.
              Pokémon data from{' '}
              <a href="https://pokemonshowdown.com" target="_blank" rel="noopener noreferrer"
                 className="text-blue-400 hover:text-blue-300">
                Pokémon Showdown
              </a>.
              Select any month from November 2014 to present. Choose from 25+ tiers across all 9 generations.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, description, icon }) {
  return (
    <div className="bg-slate-800/40 rounded-lg p-4">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-medium text-white text-sm mb-1">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function BuildIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.36 5.36a2.121 2.121 0 01-3-3l5.36-5.36m5.94 5.94l5.36-5.36a2.121 2.121 0 00-3-3l-5.36 5.36m-1.41-1.41l3-3m-3 3l-3 3m3-3l3 3" />
    </svg>
  );
}

function BrainIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}
