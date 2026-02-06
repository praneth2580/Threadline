import { useState, useMemo, useEffect, Component, type ReactNode } from "react"
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button
} from "@mui/material"
import {
  DarkMode,
  LightMode,
  AccountTree,
  Storage,
  Search,
  Refresh,
  SettingsBrightness
} from "@mui/icons-material"
import { AccountsManager } from "./components/AccountsManager"
import { RulesManager } from "./components/RulesManager"
import { createAppTheme } from "./theme"

// --- Error Boundary ---
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', justifyContent: 'center' }}>
          <Alert severity="error" variant="filled" sx={{ mb: 2, maxWidth: 600 }}>
            <Typography variant="h6">Application Crashed</Typography>
            <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
              {this.state.error?.message}
            </Typography>
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>Reload Application</Button>
        </Box>
      )
    }
    return this.props.children
  }
}

// --- Types ---
type ThemeMode = 'light' | 'dark'

// --- DB Browser Component ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (window as any).api

function DbBrowser() {
  const [tables, setTables] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState("")
  const [data, setData] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTables = async () => {
    if (!api?.db) return
    setLoading(true)
    setError(null)
    try {
      const list = await api.db.getTables()
      setTables(list)
      if (list.length > 0 && !selectedTable) setSelectedTable(list[0])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tables")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTables()
  }, [])

  useEffect(() => {
    if (!selectedTable || !api?.db) return
    setLoading(true)
    api.db.query(selectedTable)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) => setData(res))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedTable])

  if (!api?.db) {
    return <Box p={4}><Alert severity="warning">Database API not available</Alert></Box>
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Table</InputLabel>
          <Select
            value={selectedTable}
            label="Table"
            onChange={(e) => setSelectedTable(e.target.value)}
          >
            {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <Button startIcon={<Refresh />} onClick={loadTables}>Refresh</Button>
      </Box>

      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : data ? (
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {data.columns.map(c => <TableCell key={c} sx={{ fontWeight: 600 }}>{c}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((row, i) => (
                <TableRow key={i} hover>
                  {data.columns.map(c => (
                    <TableCell key={c} sx={{ fontFamily: 'monospace' }}>
                      {row[c] !== null ? String(row[c]) : <span style={{ opacity: 0.5 }}>NULL</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Storage sx={{ fontSize: 48, opacity: 0.2, mb: 2 }} />
          <Typography>Select a table to view data</Typography>
        </Box>
      )}
    </Box>
  )
}

// --- Graph Placeholder ---
function GraphView() {
  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.default',
      p: 4,
      textAlign: 'center'
    }}>
      <AccountTree sx={{ fontSize: 64, color: 'primary.main', opacity: 0.5, mb: 2 }} />
      <Typography variant="h5" gutterBottom>Graph Visualization</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 400 }}>
        Enter a profile ID above to load and visualize connections.
        (This feature is currently being restored)
      </Typography>
      <Box sx={{ mt: 4, display: 'flex', gap: 1 }}>
        <TextField placeholder="Enter Profile ID" size="small" />
        <Button variant="contained" startIcon={<Search />}>Load</Button>
      </Box>
    </Box>
  )
}

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
              <Tab icon={<Storage sx={{ fontSize: 20 }} />} iconPosition="start" label="Rules" />
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
          {tab === 3 && <RulesManager />}
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
