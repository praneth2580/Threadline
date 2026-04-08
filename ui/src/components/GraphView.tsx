import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  Fade,
  Tooltip,
  alpha
} from "@mui/material"
import { Search, ZoomIn, ZoomOut, FitScreen, Download, FilterList } from "@mui/icons-material"
import { getApiBase, scrapeAuto } from "../api"

type Account = { id: number; username: string; platform: string; profile_url?: string }
type GraphNode = Account & { x: number; y: number; vx: number; vy: number; fx?: number; fy?: number }
type GraphEdge = { from: number; to: number; type: string }

const TYPE_OPTIONS = [
  { value: "", label: "All links", relationDirection: "" as const, linkType: "" },
  { value: "followers", label: "Followers", relationDirection: "followers" as const, linkType: "relation" },
  { value: "following", label: "Following", relationDirection: "following" as const, linkType: "relation" },
  { value: "both", label: "Both", relationDirection: "both" as const, linkType: "relation" },
  { value: "tagged_by", label: "Tagged by", relationDirection: "both" as const, linkType: "tagged_by" },
  { value: "same_person", label: "Same person", relationDirection: "both" as const, linkType: "same_person" },
  { value: "alt", label: "Alt account", relationDirection: "both" as const, linkType: "alt" },
]

async function scrapeInstagramAndSave(username: string): Promise<{ account?: { username: string; id: number }; error?: string }> {
  const base = await getApiBase()
  const r = await fetch(`${base}/api/scrape/instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }))
    throw new Error((err as { error?: string }).error || "Scrape failed")
  }
  return r.json()
}

type Adapter = { platform: string; baseUrl?: string; loginUrl?: string }

export function GraphView() {
  const theme = useTheme()
  const [usernameInput, setUsernameInput] = useState("")
  const [platformFilter, setPlatformFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [adapters, setAdapters] = useState<Adapter[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const [scraping, setScraping] = useState(false)
  const [openConfirm, setOpenConfirm] = useState(false)

  const [autoType, setAutoType] = useState<"profile" | "followers" | "following">("profile")
  const [autoScraping, setAutoScraping] = useState(false)
  const [autoResult, setAutoResult] = useState<null | {
    selectorUsed?: string
    selectorUpdated?: boolean
    extracted?: Array<{ text?: string }>
    error?: string
  }>(null)
  const [openAutoResult, setOpenAutoResult] = useState(false)

  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null)
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(true)

  const requestRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchAdapters = useCallback(async () => {
    try {
      const base = await getApiBase()
      const r = await fetch(`${base}/api/adapters`)
      if (r.ok) {
        const list = (await r.json()) as Adapter[]
        setAdapters(list)
      }
    } catch {
      // non-fatal
    }
  }, [])

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    setError(null)
    try {
      const base = await getApiBase()
      const params = new URLSearchParams()
      if (usernameInput.trim()) params.set("q", usernameInput.trim())
      if (platformFilter) params.set("platform", platformFilter)
      const r = await fetch(`${base}/api/accounts?${params}`)
      if (!r.ok) throw new Error(await r.text())
      const list = (await r.json()) as Account[]
      setAccounts(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts")
    } finally {
      setLoadingAccounts(false)
    }
  }, [usernameInput, platformFilter])

  const fetchGraph = useCallback(async () => {
    if (selectedIds.length === 0) {
      setNodes([])
      setEdges([])
      return
    }
    setLoadingGraph(true)
    setError(null)
    try {
      const base = await getApiBase()
      const params = new URLSearchParams()
      params.set("accountIds", selectedIds.join(","))
      if (platformFilter) params.set("platform", platformFilter)
      const opt = TYPE_OPTIONS.find((o) => o.value === typeFilter)
      if (opt?.linkType) params.set("linkType", opt.linkType)
      if (opt?.relationDirection) params.set("relationDirection", opt.relationDirection)
      const r = await fetch(`${base}/api/graph?${params}`)
      if (!r.ok) throw new Error(await r.text())
      const data = (await r.json()) as { nodes: Account[]; edges: GraphEdge[] }

      setNodes((prevNodes) => {
        const nodeMap = new Map(prevNodes.map(n => [n.id, n]))
        return data.nodes.map((n, i) => {
          const existing = nodeMap.get(n.id)
          if (existing) return { ...n, ...existing }

          const angle = (2 * Math.PI * i) / Math.max(data.nodes.length, 1)
          const radius = 220
          return {
            ...n,
            x: 400 + radius * Math.cos(angle),
            y: 300 + radius * Math.sin(angle),
            vx: 0,
            vy: 0,
          }
        })
      })
      setEdges(data.edges)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load graph")
    } finally {
      setLoadingGraph(false)
    }
  }, [selectedIds, platformFilter, typeFilter])

  useEffect(() => { fetchAdapters() }, [fetchAdapters])
  useEffect(() => { fetchAccounts() }, [fetchAccounts])
  useEffect(() => { fetchGraph() }, [fetchGraph])

  const platforms = useMemo(() => [...new Set(accounts.map((a) => a.platform))].sort(), [accounts])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25))
  const handleFit = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const screenToCanvas = (sx: number, sy: number) => {
    if (!containerRef.current) return { x: sx, y: sy }
    const rect = containerRef.current.getBoundingClientRect()
    // Center of the container is our origin for scale
    const cx = rect.width / 2
    const cy = rect.height / 2
    return {
      x: (sx - rect.left - cx - pan.x) / zoom + 400,
      y: (sy - rect.top - cy - pan.y) / zoom + 300,
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      const pos = screenToCanvas(e.clientX, e.clientY)
      const hit = nodes.find(n => {
        const dx = n.x - pos.x
        const dy = n.y - pos.y
        return Math.sqrt(dx * dx + dy * dy) < 20 // radius + slop
      })

      if (hit) {
        setDraggedNodeId(hit.id)
      } else {
        setIsPanning(true)
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    } else if (draggedNodeId !== null) {
      const pos = screenToCanvas(e.clientX, e.clientY)
      setNodes(prevNodes => prevNodes.map(n =>
        n.id === draggedNodeId ? { ...n, x: pos.x, y: pos.y, vx: 0, vy: 0, fx: pos.x, fy: pos.y } : n
      ))
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    if (draggedNodeId !== null) {
      setNodes(prevNodes => prevNodes.map(n =>
        n.id === draggedNodeId ? { ...n, fx: undefined, fy: undefined } : n
      ))
      setDraggedNodeId(null)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((z) => Math.min(3, Math.max(0.25, z + delta)))
  }

  const toggleAccount = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleScrape = async (forceUser?: string) => {
    const target = forceUser || usernameInput.trim()
    if (!target) return

    setScraping(true)
    setOpenConfirm(false)

    try {
      // Currently backend only supports Instagram specialized scrape+save
      // If platform is something else, we might need a more generic approach later
      await scrapeInstagramAndSave(target)
      fetchAccounts()
    } catch (e) {
      // Errors are surfaced via `error` state elsewhere
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScraping(false)
    }
  }

  const handleScrapeAction = () => {
    const raw = usernameInput.trim()
    if (!raw) return

    // Check if account already exists in current list
    const existing = accounts.find(a =>
      a.username.toLowerCase() === raw.toLowerCase() &&
      (platformFilter ? a.platform === platformFilter : true)
    )

    if (existing) {
      setOpenConfirm(true)
    } else {
      handleScrape(raw)
    }
  }

  const handleAutoScrape = async () => {
    const id = usernameInput.trim()
    if (!id) return

    setAutoScraping(true)
    setAutoResult(null)
    try {
      // For now, auto self-heal is wired for Instagram types (backend special-cases URL building).
      const data = (await scrapeAuto({ platform: "instagram", identifier: id, type: autoType })) as {
        selectorUsed?: string
        selectorUpdated?: boolean
        extracted?: Array<{ text?: string }>
      }
      setAutoResult({
        selectorUsed: data.selectorUsed,
        selectorUpdated: data.selectorUpdated,
        extracted: Array.isArray(data.extracted) ? data.extracted : [],
      })
      setOpenAutoResult(true)
    } catch (e) {
      setAutoResult({ error: e instanceof Error ? e.message : String(e) })
      setOpenAutoResult(true)
    } finally {
      setAutoScraping(false)
    }
  }

  // --- Physics Simulation ---
  useEffect(() => {
    if (nodes.length === 0) return

    const animate = () => {
      setNodes((currentNodes) => {
        if (currentNodes.length === 0) return []

        const newNodes = currentNodes.map(n => ({ ...n }))
        const centerX = 400
        const centerY = 300
        const repulsion = 1.0 // Increased repulsion
        const spring = 0.04   // Slightly softer springs
        const centering = 0.015
        const friction = 0.85 // More friction to avoid jitter

        // 1. Repulsion between all nodes
        for (let i = 0; i < newNodes.length; i++) {
          for (let j = i + 1; j < newNodes.length; j++) {
            const dx = newNodes[j].x - newNodes[i].x
            const dy = newNodes[j].y - newNodes[i].y
            const distSq = dx * dx + dy * dy || 1
            const dist = Math.sqrt(distSq)
            const force = repulsion * 20000 / distSq // stronger inversely proportional
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            newNodes[i].vx -= fx
            newNodes[i].vy -= fy
            newNodes[j].vx += fx
            newNodes[j].vy += fy
          }
        }

        // 2. Spring attraction for edges
        edges.forEach((edge) => {
          const from = newNodes.find((n) => n.id === edge.from)
          const to = newNodes.find((n) => n.id === edge.to)
          if (from && to) {
            const dx = to.x - from.x
            const dy = to.y - from.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const force = (dist - 150) * spring // Target distance 150
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            from.vx += fx
            from.vy += fy
            to.vx -= fx
            to.vy -= fy
          }
        })

        // 3. Centering pull and apply movement
        newNodes.forEach((n) => {
          if (n.fx !== undefined && n.fy !== undefined) {
            n.x = n.fx
            n.y = n.fy
            n.vx = 0
            n.vy = 0
          } else {
            n.vx += (centerX - n.x) * centering
            n.vy += (centerY - n.y) * centering
            n.vx *= friction
            n.vy *= friction
            n.x += n.vx
            n.y += n.vy
          }
        })

        return newNodes
      })
      requestRef.current = requestAnimationFrame(animate)
    }

    requestRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(requestRef.current)
    // This animation loop intentionally uses the functional `setNodes` form and
    // is triggered only when the edge set changes (not on every node tick).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges.length])

  const highlightedConnections = useMemo(() => {
    if (!hoveredNodeId) return new Set<number>()
    const cons = new Set<number>([hoveredNodeId])
    edges.forEach(e => {
      if (e.from === hoveredNodeId) cons.add(e.to)
      if (e.to === hoveredNodeId) cons.add(e.from)
    })
    return cons
  }, [hoveredNodeId, edges])

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Floating Toolbar Controls */}
      <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 100, display: "flex", flexDirection: "column", gap: 1, pointerEvents: "none" }}>
        <Paper
          elevation={3}
          sx={{
            p: 1.5,
            borderRadius: 3,
            display: "flex",
            gap: 1.5,
            alignItems: "center",
            pointerEvents: "auto",
            backdropFilter: "blur(8px)",
            bgcolor: alpha(theme.palette.background.paper, 0.8),
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          <IconButton onClick={() => setShowFilters(!showFilters)} color={showFilters ? "primary" : "default"}>
            <FilterList />
          </IconButton>
          <TextField
            size="small"
            placeholder="Search username…"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchAccounts()}
            sx={{ width: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            InputProps={{ startAdornment: <Search sx={{ mr: 0.5, color: "action.active", fontSize: 18 }} /> }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={fetchAccounts}
            disabled={loadingAccounts}
            sx={{ borderRadius: 2, px: 2, minWidth: 80 }}
          >
            {loadingAccounts ? <CircularProgress size={16} color="inherit" /> : "Search"}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="secondary"
            startIcon={scraping ? <CircularProgress size={16} color="inherit" /> : <Download />}
            onClick={handleScrapeAction}
            disabled={scraping || !usernameInput.trim()}
            sx={{ borderRadius: 2, px: 2 }}
          >
            {scraping ? "Scraping…" : "Scrape"}
          </Button>
          <Tooltip title="Self-healing scrape (Instagram)">
            <span>
              <Button
                variant="outlined"
                size="small"
                onClick={handleAutoScrape}
                disabled={autoScraping || !usernameInput.trim()}
                sx={{ borderRadius: 2, px: 2, whiteSpace: "nowrap" }}
              >
                {autoScraping ? <CircularProgress size={16} /> : "Auto scrape"}
              </Button>
            </span>
          </Tooltip>
        </Paper>

        <Fade in={showFilters}>
          <Paper
            elevation={3}
            sx={{
              p: 1.5,
              borderRadius: 3,
              display: "flex",
              gap: 1.5,
              pointerEvents: "auto",
              backdropFilter: "blur(8px)",
              bgcolor: alpha(theme.palette.background.paper, 0.8),
              border: `1px solid ${theme.palette.divider}`
            }}
          >
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Platform</InputLabel>
              <Select value={platformFilter} label="Platform" onChange={(e) => setPlatformFilter(e.target.value)} sx={{ borderRadius: 2 }}>
                <MenuItem value="">All</MenuItem>
                {adapters.length > 0 ? adapters.map(a => <MenuItem key={a.platform} value={a.platform}>{a.platform}</MenuItem>) : platforms.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Type</InputLabel>
              <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)} sx={{ borderRadius: 2 }}>
                {TYPE_OPTIONS.map(opt => <MenuItem key={opt.value || "all"} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Auto type</InputLabel>
              <Select
                value={autoType}
                label="Auto type"
                onChange={(e) => setAutoType(e.target.value as "profile" | "followers" | "following")}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="profile">Instagram profile</MenuItem>
                <MenuItem value="followers">Instagram followers</MenuItem>
                <MenuItem value="following">Instagram following</MenuItem>
              </Select>
            </FormControl>
          </Paper>
        </Fade>
      </Box>

      <Dialog open={openAutoResult} onClose={() => setOpenAutoResult(false)} maxWidth="md" fullWidth>
        <DialogTitle>Auto scrape result</DialogTitle>
        <DialogContent dividers>
          {autoResult?.error ? (
            <Alert severity="error">{autoResult.error}</Alert>
          ) : (
            <>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                <Chip
                  color={autoResult?.selectorUpdated ? "primary" : "default"}
                  label={autoResult?.selectorUpdated ? "Selector updated" : "Selector unchanged"}
                  size="small"
                />
                {autoResult?.selectorUsed && (
                  <Chip label={`Selector: ${autoResult.selectorUsed}`} size="small" variant="outlined" />
                )}
                <Chip label={`Rows: ${autoResult?.extracted?.length ?? 0}`} size="small" variant="outlined" />
              </Box>

              <Paper
                variant="outlined"
                className="custom-scrollbar"
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  maxHeight: 360,
                  overflow: "auto",
                  bgcolor: alpha(theme.palette.background.paper, 0.6),
                }}
              >
                {(autoResult?.extracted || []).slice(0, 200).map((r, idx) => (
                  <Typography key={idx} variant="body2" sx={{ opacity: 0.9, mb: 0.5, whiteSpace: "pre-wrap" }}>
                    {r.text || ""}
                  </Typography>
                ))}
                {(autoResult?.extracted?.length || 0) === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No rows extracted.
                  </Typography>
                )}
              </Paper>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAutoResult(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Floating Selection Row */}
      <Box sx={{ position: "absolute", bottom: 16, left: 16, right: 80, zIndex: 100, pointerEvents: "none" }}>
        {accounts.length > 0 && (
          <Paper
            elevation={3}
            className="no-scrollbar"
            sx={{
              p: 0.75,
              borderRadius: 3.5,
              display: "flex",
              flexWrap: "nowrap",
              gap: 1,
              alignItems: "center",
              pointerEvents: "auto",
              overflowX: "auto",
              backdropFilter: "blur(12px)",
              bgcolor: alpha(theme.palette.background.paper, 0.8),
              border: `1px solid ${theme.palette.divider}`,
              maxWidth: "100%",
              boxShadow: `0 8px 32px 0 ${alpha(theme.palette.common.black, 0.2)}`,
            }}
          >
            <Box
              sx={{
                position: "sticky",
                left: -6, // Account for parent padding
                zIndex: 10,
                px: 2,
                py: 1,
                ml: -0.75,
                my: -0.75,
                display: "flex",
                alignItems: "center",
                bgcolor: alpha(theme.palette.background.paper, 0.95),
                backdropFilter: "blur(16px)",
                borderRight: `1px solid ${theme.palette.divider}`,
                borderRadius: "14px 0 0 14px",
                flexShrink: 0,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "primary.main",
                  whiteSpace: "nowrap"
                }}
              >
                Accounts:
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 0.75, px: 1 }}>
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  size="small"
                  label={a.username}
                  color={selectedIds.includes(a.id) ? "primary" : "default"}
                  variant={selectedIds.includes(a.id) ? "filled" : "outlined"}
                  onClick={() => toggleAccount(a.id)}
                  sx={{
                    borderRadius: 1.5,
                    flexShrink: 0,
                    fontWeight: 500,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      transform: "translateY(-1px)",
                      boxShadow: selectedIds.includes(a.id)
                        ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`
                        : `0 4px 8px ${alpha(theme.palette.action.focus, 0.1)}`,
                    }
                  }}
                />
              ))}
            </Box>
          </Paper>
        )}
      </Box>

      {/* Floating Error Alert */}
      {error && (
        <Box sx={{ position: "absolute", top: 100, left: "50%", transform: "translateX(-50%)", zIndex: 1000, width: "auto", maxWidth: "80%" }}>
          <Alert severity="error" onClose={() => setError(null)} variant="filled" sx={{ borderRadius: 3, boxShadow: 6 }}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Graph Canvas Wrapper */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          bgcolor: theme.palette.background.default,
          cursor: isPanning ? "grabbing" : (draggedNodeId ? "grabbing" : "grab"),
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Floating zoom controls */}
        <Paper
          elevation={4}
          sx={{
            position: "absolute",
            bottom: 16,
            right: 16,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            p: 0.5,
            borderRadius: 3,
            bgcolor: "primary.main",
            color: "white"
          }}
        >
          <IconButton size="small" onClick={handleZoomIn} sx={{ color: "white" }}><ZoomIn fontSize="small" /></IconButton>
          <Typography variant="caption" sx={{ textAlign: "center", fontWeight: 900, color: "white" }}>{Math.round(zoom * 100)}%</Typography>
          <IconButton size="small" onClick={handleZoomOut} sx={{ color: "white" }}><ZoomOut fontSize="small" /></IconButton>
          <IconButton size="small" onClick={handleFit} sx={{ color: "white" }}><FitScreen fontSize="small" /></IconButton>
        </Paper>

        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          {loadingGraph && selectedIds.length > 0 ? (
            <CircularProgress />
          ) : nodes.length === 0 && selectedIds.length > 0 ? (
            <Typography color="text.secondary">No connections found.</Typography>
          ) : nodes.length === 0 ? (
            <Box sx={{ textAlign: "center", opacity: 0.5 }}>
              <Search sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6">Search and select accounts to visualize</Typography>
            </Box>
          ) : (
            <Fade in={!loadingGraph && nodes.length > 0} timeout={800}>
              <Box>
                <svg width={800} height={600} style={{ overflow: "visible" }}>
                  <defs>
                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                      <feOffset dx="1" dy="1" result="offsetblur" />
                      <feComponentTransfer>
                        <feFuncA type="linear" slope="0.3" />
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <marker id="arrow" markerWidth={10} markerHeight={10} refX={22} refY={5} orient="auto">
                      <path d="M0,0 L10,5 L0,10 z" fill={theme.palette.text.secondary} opacity={0.5} />
                    </marker>
                    <marker id="arrow-high" markerWidth={10} markerHeight={10} refX={22} refY={5} orient="auto">
                      <path d="M0,0 L10,5 L0,10 z" fill={theme.palette.primary.main} />
                    </marker>
                  </defs>

                  {/* Edges */}
                  {edges.map((e, i) => {
                    const fromNode = nodes.find(n => n.id === e.from)
                    const toNode = nodes.find(n => n.id === e.to)
                    if (!fromNode || !toNode) return null
                    const isHigh = hoveredNodeId && (e.from === hoveredNodeId || e.to === hoveredNodeId)
                    const isRelation = e.type === "relation"
                    return (
                      <line
                        key={`${e.from}-${e.to}-${i}`}
                        x1={fromNode.x} y1={fromNode.y}
                        x2={toNode.x} y2={toNode.y}
                        stroke={isHigh ? theme.palette.primary.main : theme.palette.text.secondary}
                        strokeOpacity={isHigh ? 1 : (hoveredNodeId ? 0.1 : 0.4)}
                        strokeWidth={isHigh ? 2.5 : 1.2}
                        strokeDasharray={isRelation ? undefined : "5 3"}
                        markerEnd={isRelation ? (isHigh ? "url(#arrow-high)" : "url(#arrow)") : undefined}
                        style={{ transition: "stroke 0.2s, stroke-opacity 0.2s, stroke-width 0.2s" }}
                      />
                    )
                  })}

                  {/* Nodes */}
                  {nodes.map((n) => {
                    const isSelected = selectedIds.includes(n.id)
                    const isHovered = hoveredNodeId === n.id
                    const isConnected = hoveredNodeId && highlightedConnections.has(n.id)
                    const opacity = hoveredNodeId ? (isConnected ? 1 : 0.3) : 1

                    return (
                      <Tooltip
                        key={n.id}
                        title={`${n.username} (@${n.platform})`}
                        arrow
                        enterDelay={500}
                        placement="top"
                      >
                        <g
                          style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                          onMouseEnter={() => setHoveredNodeId(n.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onClick={() => toggleAccount(n.id)}
                          opacity={opacity}
                          filter="url(#shadow)"
                        >
                          <circle
                            cx={n.x} cy={n.y}
                            r={isHovered ? 16 : (isSelected ? 14 : 12)}
                            fill={isHovered ? theme.palette.primary.light : (isSelected ? theme.palette.primary.main : "#fff")}
                            stroke={theme.palette.primary.main}
                            strokeWidth={isSelected || isHovered ? 2.5 : 2}
                            style={{ transition: "r 0.2s, fill 0.2s, stroke-width 0.2s" }}
                          />
                          <text
                            x={n.x} y={n.y + (isHovered ? 28 : 24)}
                            textAnchor="middle"
                            fontSize={isHovered ? 12 : 11}
                            fontWeight={isHovered || isSelected ? 700 : 400}
                            fill={theme.palette.text.primary}
                            style={{ transition: "font-size 0.2s, font-weight 0.2s" }}
                          >
                            {n.username}
                          </text>
                          <text
                            x={n.x} y={n.y + (isHovered ? 40 : 36)}
                            textAnchor="middle"
                            fontSize={isHovered ? 10 : 9}
                            fill={theme.palette.text.secondary}
                            style={{ pointerEvents: "none" }}
                          >
                            {n.platform}
                          </text>
                        </g>
                      </Tooltip>
                    )
                  })}
                </svg>
              </Box>
            </Fade>
          )}
        </Box>
      </Box>

      {/* Confirmation dialog for re-scraping */}
      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)}>
        <DialogTitle>Update Account?</DialogTitle>
        <DialogContent>
          <Typography>
            The account <strong>{usernameInput}</strong> already exists in your database.
            Do you want to re-scrape it to update its connections and profile data?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)}>Cancel</Button>
          <Button onClick={() => handleScrape()} variant="contained" color="secondary" autoFocus>
            Update & Rescrape
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
