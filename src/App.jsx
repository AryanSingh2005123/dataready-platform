import { useState } from 'react'
import { CheckCircle2, ShieldCheck, Database, BookOpen } from 'lucide-react'
import Overview from './pages/Overview.jsx'
import Validator from './pages/Validator.jsx'
import SqlWorkbench from './pages/SqlWorkbench.jsx'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen, el: Overview },
  { id: 'validator', label: 'Validator', icon: ShieldCheck, el: Validator },
  { id: 'sql', label: 'SQL Workbench', icon: Database, el: SqlWorkbench },
]

export default function App() {
  const [tab, setTab] = useState('overview')
  const Active = TABS.find((t) => t.id === tab).el

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo"><CheckCircle2 size={18} /></span>
          <span>
            DataReady
            <small>Transaction validation · data readiness</small>
          </span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        <Active goTo={setTab} />
      </main>

      <footer className="footer">
        Built for the Xeno Implementation Internship assignment · runs entirely in your browser — no data leaves this tab.
      </footer>
    </div>
  )
}
