import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { IconButton, Tooltip } from '@mui/material';
import { useThemeMode } from '../contexts/ThemeModeContext';

export function ThemeToggle() {
  const { mode, toggleMode } = useThemeMode();
  const nextMode = mode === 'dark' ? 'light' : 'dark';

  return (
    <Tooltip title={`Switch to ${nextMode} mode`}>
      <IconButton
        color="inherit"
        onClick={toggleMode}
        aria-label={`Switch to ${nextMode} mode`}
        size="medium"
      >
        {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
