import { useState, useEffect } from 'react';
import { NetworkGraph } from './components/NetworkGraph';
import './App.css';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

function App() {
  const [scraperStatus, setScraperStatus] = useState<string>('—');
  const [dbStatus, setDbStatus] = useState<string>('—');

  useEffect(() => {
    if (!isTauri()) return;

    const checkScraper = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/tauri');
        const res = await invoke<string>('scraper_request', {
          method: 'GET',
          path: '/',
          body: null,
        });
        const parsed = JSON.parse(res) as { hello?: string; service?: string };
        setScraperStatus(parsed.service ?? res);
      } catch (e) {
        setScraperStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    const checkDb = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/tauri');
        await invoke('db_query', { sql: 'SELECT 1' });
        setDbStatus('OK');
      } catch (e) {
        setDbStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    checkScraper();
    checkDb();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Threadline</h1>
        <p className="subtitle">Social network builder</p>
        <div className="status-bar">
          <span title="Scraper (HTTP)">Scraper: {scraperStatus}</span>
          <span title="SQLite">DB: {dbStatus}</span>
        </div>
      </header>
      <main className="app-main">
        <div className="graph-container">
          <NetworkGraph width={1100} height={640} />
        </div>
      </main>
    </div>
  );
}

export default App;
