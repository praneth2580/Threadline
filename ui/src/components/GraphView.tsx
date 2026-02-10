import { useState, useEffect, useCallback, useMemo } from "react"
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
  OutlinedInput,
  Alert,
  CircularProgress,
  IconButton,
  Paper,
  useTheme
} from "@mui/material"
import { Search, ZoomIn, ZoomOut, FitScreen, Refresh } from "@mui/icons-material"
import { getApiBase } from "../api"

type Account = { id: number; username: string; platform: string; profile_url?: string }
type GraphNode = Account
type GraphEdge = { from: number; to: number; type: string }

const LINK_TYPES = [
  { value: "", label: "All links" },
  { value: "relation", label: "Follows / relation" },
  { value: "same_person", label: "Same person" },
  { value: "alt", label: "Alt account" },
]

function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]): Map<number, { x: number; y: number }> {
  const pos = new Map<number, { x: number; y: number }>()
  const centerX = 400
  const centerY = 300
  const radius = 220
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1)
    pos.set(n.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    })
  })
  return pos
}

export function GraphView() {
  const theme = useTheme()
  const [search, setSearch] = useState("")
  const [platformFilter, setPlatformFilter] = useState("")
  const [linkTypeFilter, setLinkTypeFilter] = useState("")
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

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    setError(null)
    try {
      const base = await getApiBase()
      const params = new URLSearchParams()
      if (search.trim()) params.set("q", search.trim())
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
  }, [search, platformFilter])

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
      if (linkTypeFilter) params.set("linkType", linkTypeFilter)
      const r = await fetch(`${base}/api/graph?${params}`)
      if (!r.ok) throw new Error(await r.text())
      const data = (await r.json()) as { nodes: GraphNode[]; edges: GraphEdge[] }
      setNodes(data.nodes)
      setEdges(data.edges)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load graph")
    } finally {
      setLoadingGraph(false)
    }
  }, [selectedIds, platformFilter, linkTypeFilter])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  const positions = useMemo(() => layoutNodes(nodes, edges), [nodes, edges])
  const platforms = useMemo(() => [...new Set(accounts.map((a) => a.platform))].sort(), [accounts])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25))
  const handleFit = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }
  const handleMouseUp = () => setIsPanning(false)
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

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar: search, filters, account selector, zoom */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 0,
          borderLeft: 0,
          borderRight: 0,
          borderTop: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
        }}
      >
        <TextField
          size="small"
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchAccounts()}
          sx={{ minWidth: 200 }}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: "action.active" }} /> }}
        />
        <Button variant="outlined" size="small" onClick={fetchAccounts} startIcon={<Refresh />}>
          Search
        </Button>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Platform</InputLabel>
          <Select
            value={platformFilter}
            label="Platform"
            onChange={(e) => setPlatformFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {platforms.map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Link type</InputLabel>
          <Select
            value={linkTypeFilter}
            label="Link type"
            onChange={(e) => setLinkTypeFilter(e.target.value)}
          >
            {LINK_TYPES.map((opt) => (
              <MenuItem key={opt.value || "all"} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel>Accounts to show connections of</InputLabel>
          <Select
            multiple
            value={selectedIds}
            onChange={(e) => setSelectedIds(Array.from(e.target.value as number[]))}
            input={<OutlinedInput label="Accounts to show connections of" />}
            renderValue={(ids) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {ids.slice(0, 3).map((id) => {
                  const a = accounts.find((x) => x.id === id)
                  return <Chip key={id} size="small" label={a ? `${a.username}@${a.platform}` : id} />
                })}
                {ids.length > 3 && <Chip size="small" label={`+${ids.length - 3}`} />}
              </Box>
            )}
          >
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.username} ({a.platform})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
          <IconButton size="small" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut />
          </IconButton>
          <Typography variant="caption" sx={{ minWidth: 36, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton size="small" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn />
          </IconButton>
          <IconButton size="small" onClick={handleFit} title="Reset view">
            <FitScreen />
          </IconButton>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Graph canvas */}
      <Box
        sx={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          bgcolor: "background.default",
          cursor: isPanning ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
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
            <Typography color="text.secondary">No connections found for selected accounts.</Typography>
          ) : nodes.length === 0 ? (
            <Typography color="text.secondary">
              Search accounts above and select one or more to show their connections.
            </Typography>
          ) : (
            <svg
              width={800}
              height={600}
              style={{ overflow: "visible" }}
            >
              <defs>
                <marker
                  id="arrow"
                  markerWidth={8}
                  markerHeight={8}
                  refX={6}
                  refY={4}
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill={theme.palette.text.secondary} />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const fromPos = positions.get(e.from)
                const toPos = positions.get(e.to)
                if (!fromPos || !toPos) return null
                const isRelation = e.type === "relation"
                return (
                  <line
                    key={`${e.from}-${e.to}-${i}`}
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke={theme.palette.text.secondary}
                    strokeOpacity={0.5}
                    strokeWidth={isRelation ? 1.5 : 1}
                    strokeDasharray={isRelation ? undefined : "4 2"}
                    markerEnd={isRelation ? "url(#arrow)" : undefined}
                  />
                )
              })}
              {nodes.map((n) => {
                const pos = positions.get(n.id)
                if (!pos) return null
                const selected = selectedIds.includes(n.id)
                return (
                  <g
                    key={n.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleAccount(n.id)}
                  >
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={selected ? 14 : 10}
                      fill={theme.palette.primary.main}
                      fillOpacity={selected ? 0.9 : 0.6}
                      stroke={theme.palette.primary.dark}
                      strokeWidth={selected ? 2 : 1}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 24}
                      textAnchor="middle"
                      fontSize={11}
                      fill={theme.palette.text.primary}
                    >
                      {n.username}
                    </text>
                    <text
                      x={pos.x}
                      y={pos.y + 36}
                      textAnchor="middle"
                      fontSize={9}
                      fill={theme.palette.text.secondary}
                    >
                      {n.platform}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </Box>
      </Box>
    </Box>
  )
}
