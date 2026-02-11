import { useState, useMemo, useEffect } from "react"
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Tabs,
  Tab
} from "@mui/material"
import { DarkMode, LightMode, AccountTree, Storage } from "@mui/icons-material"
import { AccountsManager } from "./components/AccountsManager"
import { GraphView } from "./components/GraphView"
import { DbBrowser } from "./components/DbBrowser"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { createAppTheme } from "./theme"

// --- Types ---
type ThemeMode = 'light' | 'dark'

// --- App Content ---
function AppContent() {
  const [mode, setMode] = useState<ThemeMode>(() => (localStorage.getItem('theme') as ThemeMode) || 'light')
  const [tab, setTab] = useState(0)

  const theme = useMemo(() => createAppTheme(mode), [mode])

  // Persist theme
  useEffect(() => {
    localStorage.setItem('theme', mode)
  }, [mode])

  const toggleTheme = () => setMode(prev => prev === 'light' ? 'dark' : 'light')

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar variant="dense">
            <Typography variant="h6" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: -1 }}>//</Box> Threadline
            </Typography>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mr: 2 }}>
              <Tab icon={<AccountTree sx={{ fontSize: 20 }} />} iconPosition="start" label="Graph" />
              <Tab icon={<Storage sx={{ fontSize: 20 }} />} iconPosition="start" label="Database" />
              <Tab icon={<Storage sx={{ fontSize: 20 }} />} iconPosition="start" label="Accounts" />
            </Tabs>

            <IconButton onClick={toggleTheme} color="inherit">
              {mode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {tab === 0 && <GraphView />}
          {tab === 1 && <DbBrowser />}
          {tab === 2 && <AccountsManager />}
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}
