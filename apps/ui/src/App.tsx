import { useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { AppTabs } from './components/AppTabs';
import { ThemeToggle } from './components/ThemeToggle';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

function App() {
  useEffect(() => {
    if (!isTauri()) return;
    const check = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/tauri');
        await invoke('scraper_request', { method: 'GET', path: '/', body: null });
        await invoke('db_query', { sql: 'SELECT 1' });
      } catch {
        // ignore
      }
    };
    check();
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense" disableGutters sx={{ px: 2, minHeight: { xs: 48 } }}>
          <Box component="img" src="/threadline-logo.png" alt="" sx={{ height: 28, width: 'auto', mr: 1.5, display: { xs: 'none', sm: 'block' } }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <Typography variant="h1" component="h1" sx={{ flexGrow: 1, fontSize: '1.25rem', fontWeight: 600 }}>
            Threadline
          </Typography>
          <ThemeToggle />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Paper
          elevation={0}
          square
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            bgcolor: 'background.paper',
          }}
        >
          <AppTabs />
        </Paper>
      </Box>
    </Box>
  );
}

export default App;
