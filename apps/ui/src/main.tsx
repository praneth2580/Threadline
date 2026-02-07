import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeModeContext';
import { getTheme } from './theme';
import App from './App';
import './index.css';

function MuiThemeWrapper({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const theme = getTheme(mode);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

function AppWithTheme() {
  return (
    <ThemeModeProvider>
      <MuiThemeWrapper>
        <App />
      </MuiThemeWrapper>
    </ThemeModeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithTheme />
  </StrictMode>
);
