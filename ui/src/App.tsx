import { useState, useMemo, useEffect } from "react"
import { ThemeProvider, CssBaseline, Box } from "@mui/material"
import { AccountsManager } from "./components/AccountsManager"
import { GraphView } from "./components/GraphView"
import { DbBrowser } from "./components/DbBrowser"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { createAppTheme } from "./theme"
import { AppShell, type AppSection } from "./components/AppShell"

// --- Types ---
type ThemeMode = 'light' | 'dark'

// --- App Content ---
function AppContent() {
  const [mode, setMode] = useState<ThemeMode>(() => (localStorage.getItem('theme') as ThemeMode) || 'light')
  const [section, setSection] = useState<AppSection>("graph")

  const theme = useMemo(() => createAppTheme(mode), [mode])

  // Persist theme
  useEffect(() => {
    localStorage.setItem('theme', mode)
  }, [mode])

  const toggleTheme = () => setMode(prev => prev === 'light' ? 'dark' : 'light')

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell
        section={section}
        onSectionChange={setSection}
        mode={mode}
        onToggleTheme={toggleTheme}
      >
        <Box sx={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
          {section === "graph" && <GraphView />}
          {section === "database" && <DbBrowser />}
          {section === "accounts" && <AccountsManager />}
        </Box>
      </AppShell>
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
