import { useState } from 'react'
import './App.css'

type GraphFilter = 'all' | 'followers' | 'following' | 'mutual'

function App() {
  const [username, setUsername] = useState('')
  const [filter, setFilter] = useState<GraphFilter>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const handleLoadProfile = () => {
    if (!username.trim()) return
    setIsLoading(true)
    // Placeholder: will be replaced by IPC call to backend
    setTimeout(() => setIsLoading(false), 1200)
  }

  const filters: { value: GraphFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'followers', label: 'Followers' },
    { value: 'following', label: 'Following' },
    { value: 'mutual', label: 'Mutual' },
  ]

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">
          <img src="/threadline-logo.svg" alt="" className="logo-icon" width={28} height={28} />
          Threadline
        </h1>
        <p className="tagline">Visualize connections</p>
      </header>

      <section className="profile-bar">
        <div className="profile-input-wrap">
          <input
            type="text"
            className="profile-input"
            placeholder="Username or profile ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoadProfile()}
            disabled={isLoading}
          />
          <select className="platform-select" aria-label="Platform">
            <option value="mock">Mock (demo)</option>
          </select>
          <button
            type="button"
            className="btn-primary"
            onClick={handleLoadProfile}
            disabled={isLoading || !username.trim()}
          >
            {isLoading ? 'Loading…' : 'Load profile'}
          </button>
        </div>
      </section>

      <div className="main">
        <div className="graph-container">
          <div className="graph-placeholder">
            <div className="graph-placeholder-inner">
              <span className="graph-placeholder-icon">◇</span>
              <p>3D graph will appear here</p>
              <p className="graph-placeholder-hint">
                Enter a username and click Load profile to fetch relationships.
              </p>
            </div>
          </div>
        </div>

        <aside className="sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Filter</h3>
            <div className="filter-tabs">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`filter-tab ${filter === f.value ? 'active' : ''}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Inspect</h3>
            {selectedNode ? (
              <div className="inspect-card">
                <p className="inspect-label">Selected node</p>
                <p className="inspect-value">{selectedNode}</p>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setSelectedNode(null)}
                >
                  Clear
                </button>
              </div>
            ) : (
              <p className="sidebar-empty">
                Click a node in the graph to inspect it.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
