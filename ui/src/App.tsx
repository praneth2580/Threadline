import { useState, useEffect, useMemo } from "react"
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Button,
  FormControl,
  Select,
  InputLabel,
  Box,
  Paper,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
} from "@mui/material"
import DarkModeIcon from "@mui/icons-material/DarkMode"
import LightModeIcon from "@mui/icons-material/LightMode"
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import SearchIcon from "@mui/icons-material/Search"
import FilterListIcon from "@mui/icons-material/FilterList"
import VisibilityIcon from "@mui/icons-material/Visibility"
import StorageIcon from "@mui/icons-material/Storage"
import RefreshIcon from "@mui/icons-material/Refresh"
import type { Theme } from "@mui/material/styles"
import { createAppTheme } from "./theme"

const THEME_STORAGE_KEY = "threadline-theme"
export type ThemeMode = "light" | "dark" | "system"

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system"
  const s = localStorage.getItem(THEME_STORAGE_KEY)
  if (s === "light" || s === "dark" || s === "system") return s
  return "system"
}

function useSystemTheme() {
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true
    const api = (window as unknown as { api?: { getSystemTheme?: () => string } }).api
    if (api?.getSystemTheme) return api.getSystemTheme() === "dark"
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  })

  useEffect(() => {
    const api = (window as unknown as { api?: { onSystemThemeChange?: (cb: (theme: string) => void) => () => void } }).api
    if (api?.onSystemThemeChange) {
      const unsubscribe = api.onSystemThemeChange((theme: string) => setSystemDark(theme === "dark"))
      return unsubscribe
    }
    const m = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => setSystemDark(m.matches)
    m.addEventListener("change", handler)
    return () => m.removeEventListener("change", handler)
  }, [])

  return systemDark ? "dark" : "light"
}

function useResolvedTheme() {
  const systemTheme = useSystemTheme()
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme)

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  }, [mode])

  const resolvedMode: "light" | "dark" = useMemo(() => {
    if (mode === "system") return systemTheme
    return mode
  }, [mode, systemTheme])

  return { mode, setMode, resolvedMode }
}

type GraphFilter = "all" | "followers" | "following" | "mutual"

const hasDbApi = () =>
  typeof (window as unknown as { api?: { db?: unknown } }).api?.db === "object"

function DbBrowser() {
  const [tables, setTables] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState("")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [data, setData] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = (window as unknown as { api: { db: { getTables: () => Promise<string[]>; query: (t: string, s?: string) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }> } } }).api

  const loadTables = useMemo(
    () => async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await api.db.getTables()
        setTables(list)
        setSelectedTable((prev) => (list.length > 0 && !list.includes(prev) ? list[0] : prev))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tables")
      } finally {
        setLoading(false)
      }
    },
    [api.db]
  )

  useEffect(() => {
    if (!hasDbApi()) return
    loadTables()
  }, [loadTables])

  useEffect(() => {
    if (!hasDbApi() || !selectedTable) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api.db
      .query(selectedTable, search || undefined)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Query failed")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [api.db, selectedTable, search])

  const handleSearchSubmit = () => setSearch(searchInput)

  if (!hasDbApi()) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <StorageIcon sx={{ fontSize: 48, color: "text.secondary", opacity: 0.6 }} />
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Database browser is only available in the desktop app.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Box sx={{ p: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", borderBottom: 1, borderColor: "divider" }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Table</InputLabel>
          <Select
            label="Table"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          >
            {tables.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="Search…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          sx={{ width: 220 }}
        />
        <Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={handleSearchSubmit}>
          Search
        </Button>
        <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadTables}>
          Refresh
        </Button>
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mx: 2, mt: 1 }}>
          {error}
        </Alert>
      )}
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        {loading && !data ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : data ? (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {data.columns.map((col) => (
                  <TableCell key={col} variant="head" sx={{ fontWeight: 600 }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={data.columns.length} align="center" color="text.secondary">
                    No rows
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row, i) => (
                  <TableRow key={i}>
                    {data.columns.map((col) => (
                      <TableCell key={col} sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {row[col] != null ? String(row[col]) : "NULL"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : null}
      </TableContainer>
    </Box>
  )
}

function AppContent() {
  const { mode, setMode, resolvedMode } = useResolvedTheme()
  const [themeAnchor, setThemeAnchor] = useState<null | HTMLElement>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [username, setUsername] = useState("")
  const [filter, setFilter] = useState<GraphFilter>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode])

  const handleLoadProfile = () => {
    if (!username.trim()) return
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1200)
  }

  const closeThemeMenu = () => setThemeAnchor(null)

  const filters: { value: GraphFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "followers", label: "Followers" },
    { value: "following", label: "Following" },
    { value: "mutual", label: "Mutual" },
  ]

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AppBar position="static" color="default" enableColorOnDark>
          <Toolbar sx={{ gap: 1 }}>
            <img
              src="/threadline-logo.svg"
              alt=""
              width={28}
              height={28}
              style={{ display: "block" }}
            />
            <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
              Threadline
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              Visualize connections
            </Typography>
            <IconButton
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => setThemeAnchor(e.currentTarget)}
              aria-label="Theme"
              color="inherit"
            >
              {resolvedMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Toolbar>
        </AppBar>

        <Menu
          anchorEl={themeAnchor}
          open={Boolean(themeAnchor)}
          onClose={closeThemeMenu}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem onClick={() => { setMode("light"); closeThemeMenu() }}>
            <ListItemIcon><LightModeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Light{mode === "light" ? " ✓" : ""}</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMode("dark"); closeThemeMenu() }}>
            <ListItemIcon><DarkModeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Dark{mode === "dark" ? " ✓" : ""}</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMode("system"); closeThemeMenu() }}>
            <ListItemIcon><SettingsBrightnessIcon fontSize="small" /></ListItemIcon>
            <ListItemText>System{mode === "system" ? " ✓" : ""}</ListItemText>
          </MenuItem>
        </Menu>

        <Tabs value={activeTab} onChange={(_, v: number) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
          <Tab icon={<AccountTreeIcon />} iconPosition="start" label="Graph" />
          <Tab icon={<StorageIcon />} iconPosition="start" label="Database" />
        </Tabs>

        {activeTab === 0 && (
          <>
            <Paper square elevation={0} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", maxWidth: 560, flexWrap: "wrap" }}>
                <TextField
                  placeholder="Username or profile ID"
                  value={username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleLoadProfile()}
                  disabled={isLoading}
                  size="small"
                  sx={{ flex: 1, minWidth: 180 }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Platform</InputLabel>
                  <Select label="Platform" value="mock">
                    <MenuItem value="mock">Mock (demo)</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  onClick={handleLoadProfile}
                  disabled={isLoading || !username.trim()}
                  startIcon={isLoading ? null : <SearchIcon />}
                >
                  {isLoading ? "Loading…" : "Load profile"}
                </Button>
              </Box>
            </Paper>

            <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "background.default",
                  background: (t: Theme) =>
                    `radial-gradient(ellipse 80% 50% at 50% 35%, ${t.palette.primary.main}14 0%, transparent 60%)`,
                }}
              >
                <Box sx={{ textAlign: "center", px: 3, py: 4 }}>
                  <AccountTreeIcon sx={{ fontSize: 56, color: "primary.main", opacity: 0.6 }} />
                  <Typography variant="subtitle1" fontWeight={500} sx={{ mt: 1 }}>
                    3D graph will appear here
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Enter a username and click Load profile to fetch relationships.
                  </Typography>
                </Box>
              </Box>

              <Paper
                square
                elevation={0}
                sx={{
                  width: 280,
                  flexShrink: 0,
                  p: 2,
                  borderLeft: 1,
                  borderColor: "divider",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 1, display: "block", mb: 1 }}>
                    <FilterListIcon sx={{ fontSize: 14, verticalAlign: "middle", mr: 0.5 }} />
                    Filter
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    value={filter}
                    exclusive
                    onChange={(_: React.MouseEvent<HTMLElement>, v: GraphFilter | null) => v != null && setFilter(v)}
                    fullWidth
                    sx={{
                      flexWrap: "wrap",
                      "& .MuiToggleButton-root.Mui-selected": { borderRadius: 0 },
                    }}
                  >
                    {filters.map((f) => (
                      <ToggleButton key={f.value} value={f.value}>
                        {f.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 1, display: "block", mb: 1 }}>
                    <VisibilityIcon sx={{ fontSize: 14, verticalAlign: "middle", mr: 0.5 }} />
                    Inspect
                  </Typography>
                  {selectedNode ? (
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Selected node</Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ wordBreak: "break-all", mt: 0.25 }}>
                        {selectedNode}
                      </Typography>
                      <Button size="small" color="primary" onClick={() => setSelectedNode(null)} sx={{ mt: 0.5 }}>
                        Clear
                      </Button>
                    </Paper>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Click a node in the graph to inspect it.
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Box>
          </>
        )}

        {activeTab === 1 && (
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <DbBrowser />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  )
}

export default function App() {
  return <AppContent />
}
