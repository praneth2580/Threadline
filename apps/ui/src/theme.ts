import { createTheme } from '@mui/material/styles';

export function getTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#90caf9' : '#1976d2',
      },
      secondary: {
        main: mode === 'dark' ? '#ce93d8' : '#9c27b0',
      },
      background: {
        default: mode === 'dark' ? '#121212' : '#fafafa',
        paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
      },
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h1: { fontSize: '1.75rem', fontWeight: 600 },
      h2: { fontSize: '1.5rem', fontWeight: 600 },
      h3: { fontSize: '1.25rem', fontWeight: 600 },
    },
    components: {
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
    },
  });
}
