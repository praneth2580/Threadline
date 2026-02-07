import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';

export interface PlatformSession {
  id: string;
  name: string;
  loggedIn: boolean;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

async function scraperGet(path: string): Promise<string> {
  if (!isTauri()) throw new Error('Not in Tauri');
  const { invoke } = await import('@tauri-apps/api/tauri');
  return invoke<string>('scraper_request', { method: 'GET', path, body: null });
}

async function scraperPost(path: string): Promise<string> {
  if (!isTauri()) throw new Error('Not in Tauri');
  const { invoke } = await import('@tauri-apps/api/tauri');
  return invoke<string>('scraper_request', { method: 'POST', path, body: null });
}

export function SessionsTab() {
  const [platforms, setPlatforms] = useState<PlatformSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPlatform, setActionPlatform] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!isTauri()) {
      setPlatforms([
        { id: 'twitter', name: 'Twitter / X', loggedIn: false },
        { id: 'instagram', name: 'Instagram', loggedIn: false },
        { id: 'linkedin', name: 'LinkedIn', loggedIn: false },
      ]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await scraperGet('/auth/sessions');
      const data = JSON.parse(res) as { platforms: PlatformSession[] };
      setPlatforms(data.platforms || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPlatforms([
        { id: 'twitter', name: 'Twitter / X', loggedIn: false },
        { id: 'instagram', name: 'Instagram', loggedIn: false },
        { id: 'linkedin', name: 'LinkedIn', loggedIn: false },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleLogin = async (platformId: string) => {
    if (!isTauri()) return;
    setActionPlatform(platformId);
    setError(null);
    try {
      const res = await scraperPost(`/auth/${platformId}/start`);
      const data = JSON.parse(res) as { ok: boolean; message?: string };
      if (data.ok) {
        await fetchSessions();
      } else {
        setError(data.message || 'Login failed.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionPlatform(null);
    }
  };

  const handleLogout = async (platformId: string) => {
    if (!isTauri()) return;
    setActionPlatform(platformId);
    setError(null);
    try {
      await scraperPost(`/auth/${platformId}/logout`);
      await fetchSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionPlatform(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 560, mx: 'auto' }}>
      <Typography variant="h2" sx={{ mb: 2, fontSize: '1.25rem' }}>
        Social accounts
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Log in with your accounts so the scraper can use your session to collect data. A browser window will open for
        each login.
      </Typography>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {platforms.map((p) => (
          <Card key={p.id} variant="outlined">
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.5 }}>
              <Box>
                <Typography fontWeight={600}>{p.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {p.loggedIn ? 'Session saved — scraper can use it' : 'Not logged in'}
                </Typography>
              </Box>
              {p.loggedIn ? (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => handleLogout(p.id)}
                  disabled={actionPlatform !== null}
                  startIcon={actionPlatform === p.id ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {actionPlatform === p.id ? 'Logging out…' : 'Log out'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleLogin(p.id)}
                  disabled={actionPlatform !== null}
                  startIcon={actionPlatform === p.id ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {actionPlatform === p.id ? 'Opening browser…' : 'Log in'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
      {!isTauri() && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Run the app in Tauri to connect to the scraper and manage sessions.
        </Alert>
      )}
    </Box>
  );
}
