import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';

export interface PlatformSession {
  id: string;
  name: string;
  loggedIn: boolean;
}

const DEFAULT_PLATFORMS: PlatformSession[] = [
  { id: 'twitter', name: 'Twitter / X', loggedIn: false },
  { id: 'instagram', name: 'Instagram', loggedIn: false },
  { id: 'linkedin', name: 'LinkedIn', loggedIn: false },
  { id: 'facebook', name: 'Facebook', loggedIn: false },
  { id: 'reddit', name: 'Reddit', loggedIn: false },
  { id: 'tiktok', name: 'TikTok', loggedIn: false },
  { id: 'bluesky', name: 'Bluesky', loggedIn: false },
  { id: 'youtube', name: 'YouTube', loggedIn: false },
  { id: 'pinterest', name: 'Pinterest', loggedIn: false },
  { id: 'tumblr', name: 'Tumblr', loggedIn: false },
  { id: 'discord', name: 'Discord', loggedIn: false },
  { id: 'mastodon', name: 'Mastodon', loggedIn: false },
];

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
      setPlatforms(DEFAULT_PLATFORMS);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await scraperGet('/auth/sessions');
      const data = JSON.parse(res) as { platforms: PlatformSession[] };
      setPlatforms(data.platforms || DEFAULT_PLATFORMS);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPlatforms(DEFAULT_PLATFORMS);
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
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        width: '100%',
        maxWidth: 960,
        mx: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <Typography variant="h2" sx={{ mb: 1.5, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
        Social accounts
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        Log in with your accounts so the scraper can use your session to collect data. A browser window will open for
        each login.
      </Typography>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Grid container spacing={2}>
        {platforms.map((p) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 1.5,
                  py: 1.5,
                  flex: 1,
                  '&:last-child': { pb: 1.5 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={600} sx={{ fontSize: { xs: '0.9375rem', sm: '1rem' } }}>
                    {p.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
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
                    fullWidth
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
                    fullWidth
                  >
                    {actionPlatform === p.id ? 'Opening browser…' : 'Log in'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {!isTauri() && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Run the app in Tauri to connect to the scraper and manage sessions.
        </Alert>
      )}
    </Box>
  );
}
